import type { MakeAllFunctionsReturnPromises } from "./utils/type.js"

export interface Methods {}

export type TransactionID = string
interface Transaction
{
	readonly transactionID: TransactionID
	readonly resolvePromise: (value: unknown) => void
	readonly rejectPromise: (reason?: any) => void
}
interface CollabMessageBase
{
	readonly type: "call" | "return"
	readonly transactionID: TransactionID
}
interface CollabCallMessage extends CollabMessageBase
{
	readonly type: "call"
	readonly func: string
	readonly args: any | undefined
}
interface CollabReturnMessage extends CollabMessageBase
{
	readonly type: "return"
	readonly value?: any | undefined
	readonly ex?: Error | undefined
}
export type CollabMessage = CollabCallMessage | CollabReturnMessage

/** A function that processes an incoming message. */
export type CollabMessageHandler = (message: CollabMessage) => void
/** A function to be called to unregister this proxy, which will be exposed as cleanupProxy() on the proxy itself. */
export type CollabCleanupFunction = () => void
/** An object that defines how to send and receive messages. There are predefined objects you can use: see FigmaPlugin and FigmaPluginUI. */
export interface CollaborationOptions
{
	/** A unique name that identifies this iframe. */
	readonly name: string
	/** A function that sends a message to the other iframe. */
	readonly toSendMessage: (pluginMessage: CollabMessage) => void
	/** A function that registers an event handler for incoming messages and then calls the supplied inner message handler to process the message. */
	readonly toHandleMessage: (callMe: CollabMessageHandler) => CollabCleanupFunction | void
}
/** A proxy that offers a set of methods implemented on another iframe. All of the methods on this proxy have the same names and parameters as the originals, but they instead return promises. (For example, if the other iframe has a method getColor(): string, then the proxy will have a method getColor(): Promise<string>.) */
export type CollabProxy<IMethods extends Methods> = MakeAllFunctionsReturnPromises<IMethods> &
{
	/** Unregisters the proxy so that it no longer listens for events. It should no longer be used after calling this. */
	readonly cleanupProxy: CollabCleanupFunction
}

/**
	Initiates a cross-iframe collaboration in which each iframe can call methods on the other. Both iframes must call this function and supply their own methods. You can do so in either order, as long as both iframes call this function before making any cross-iframe calls.
	@param methods An object that defines all of the methods on this iframe that the other can call. All parameters and return values for the methods must be serializable to JSON.
	@param options An object that defines how to send and receive messages. There are predefined objects you can pass in: see FigmaPlugin and FigmaPluginUI.
	@returns A proxy for the other iframe's methods. All of the methods on this proxy have the same names and parameters as the originals, but they instead return promises. (For example, if the other iframe has a method getColor(): string, then the proxy will have a method getColor(): Promise<string>.)
*/
export function collab<IThisSideMethods extends Methods, IOtherSideMethods extends Methods>(
	methods: IThisSideMethods,
	options: CollaborationOptions
): CollabProxy<IOtherSideMethods>
{
	// Set up our transaction register, so that when functions on the other side send their return values back, we know which promise to attach them to.
	const transactions = new Map<TransactionID, Transaction>()
	let nextTransactionIndex = 0

	// Set up our message handler for our own methods when called by the other side.
	const cleanupFunction = options.toHandleMessage((message: CollabMessage): void =>
	{
		// Is the other side calling us, or are they returning from a call that we made?
		if (message.type === "call")
		{
			// This message is a new call to one of our methods, so this transaction won't ever be in our index.
			if (!(message.func in methods))
			{
				// We don't know what this method is!
				console.error(`Message to call unknown method "${message.func}" arrived!`)
				// If this happened, the caller is in a bad state, but at least try to return a response anyway so it doesn't hang.
				options.toSendMessage({
					type: "return",
					transactionID: message.transactionID,
					ex: new Error(`Unknown method "${message.func}"!`),
				})
			}
			// Okay, call our method.
			try
			{
				const value = (methods as any)[message.func](...message.args)
				if (value instanceof Promise)
				{
					// If the method is async, we don't send the results back until the Promise completes. But we don't have to track
					// that ourselves; just let then() handle it for us.
					value
						.then((newValue) =>
						{
							options.toSendMessage({
								type: "return",
								transactionID: message.transactionID,
								value: newValue,
							})
						})
						.catch((ex) =>
						{
							options.toSendMessage({
								type: "return",
								transactionID: message.transactionID,
								ex: ex instanceof Error ? ex.message : ex,
							})
						})
				}
				else
				{
					// Send non-async results back to the caller immediately.
					options.toSendMessage({
						type: "return",
						transactionID: message.transactionID,
						value: value,
					})
				}
			}
			catch (ex)
			{
				// Send the exception back to the caller.
				options.toSendMessage({
					type: "return",
					transactionID: message.transactionID,
					ex: ex instanceof Error ? ex.message : ex,
				})
			}
		}
		else if (message.type === "return")
		{
			// This message is the response for a call that we made earlier, so we should already know about this transaction.
			const transaction = transactions.get(message.transactionID)
			if (!transaction) throw new Error(`Return value for unknown transaction ID ${message.transactionID} arrived!`)
			if (message.ex === undefined || message.ex === null)
			{
				// The call succeeded! Resolve the promise.
				transaction.resolvePromise(message.value)
			}
			else
			{
				// The call failed! Reject the promise.
				transaction.rejectPromise(message.ex)
			}
			// We'll never hear anything about this transaction again, so we can safely remove it from our register now.
			transactions.delete(message.transactionID)
		}
		else
		{
			throw new Error(`Unknown message with type ${String((message as any).type)} arrived!`)
		}
	})

	// Create a proxy object that intercepts all calls to the other side's methods and remotes them.
	const proxy = new Proxy(
		// This proxy has nothing on it besides what's on IOtherSideMethods.
		{} as MakeAllFunctionsReturnPromises<IOtherSideMethods>,
		{
			get: function (_target, prop, _receiver): (...args: any) => Promise<any>
			{
				// Is the property one of the special methods on CollabProxy? If so, handle it first.
				if (prop === "cleanupProxy") return cleanupFunction as any

				if (typeof prop === "symbol") throw new Error(`Symbol property "${String(prop)}" is not supported.`)

				// This get function is called whenever someone accesses the property, so from this function
				// we need to return a new function that returns a Promise.
				return (...args: any): Promise<any> =>
				{
					// With this promise, the caller can await the response message.
					return new Promise((resolve, reject) =>
					{
						// Remember this transaction so we know what to do with the return value.
						const transaction: Transaction = {
							transactionID: `${options.name}:${nextTransactionIndex++}`,
							resolvePromise: resolve,
							rejectPromise: reject,
						}
						transactions.set(transaction.transactionID, transaction)

						// Now, send the call message.
						options.toSendMessage({
							type: "call",
							transactionID: transaction.transactionID,
							func: prop,
							args: args,
						})
					})
				}
			},
		}
	)

	// Return the proxy!
	return proxy as CollabProxy<IOtherSideMethods>
}
