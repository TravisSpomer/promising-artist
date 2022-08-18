import { useState, useEffect } from "react"
import { collab } from "../collab.js"
import type { Methods, CollaborationOptions, CollabProxy } from "../collab.js"

/**
	Initiates a cross-iframe collaboration in which each iframe can call methods on the other. Both iframes must call this function and supply their own methods. You can do so in either order, as long as both iframes call this function before making any cross-iframe calls. (This is a React hook that simplifies PromisingArtist.collab from a React component, but otherwise provides identical functionality.)
	@param methods An object that defines all of the methods on this iframe that the other can call. All parameters and return values for the methods must be serializable to JSON.
	@param options An object that defines how to send and receive messages. There are predefined objects you can pass in: see FigmaPlugin and FigmaPluginUI.
	@returns A proxy for the other iframe's methods. All of the methods on this proxy have the same names and parameters as the originals, but they instead return promises. (For example, if the other iframe has a method getColor(): string, then the proxy will have a method getColor(): Promise<string>.)
*/
export function useCollab<IThisSideMethods extends Methods, IOtherSideMethods extends Methods>(
	methods: IThisSideMethods,
	options: CollaborationOptions
): CollabProxy<IOtherSideMethods>
{
	const [proxy] = useState(() => collab<IThisSideMethods, IOtherSideMethods>(methods, options))
	useEffect(() =>
	{
		return function cleanup()
		{
			proxy.cleanupProxy()
		}
	}, [])
	return proxy
}
