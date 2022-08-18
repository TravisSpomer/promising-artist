/** Given a function type, produces the same type if it returns a Promise, or produces a function type that returns a Promise of the original return value if the original return value was not a Promise. (Produces never if it wasn't a function.) */
export type MakeReturnPromise<T> =
	T extends (...args: any) => Promise<any> ?
		T :
	T extends (...args: any) => any ?
		(...args: Parameters<T>) => Promise<ReturnType<T>> :
	never

/** Given an interface, returns an interface where all functions that didn't already return a Promise are converted to return a Promise. */
export type MakeAllFunctionsReturnPromises<T> = {
	readonly [Property in keyof T]: MakeReturnPromise<T[Property]>
}

/** Given a type with some readonly properties, make all of them writable. */
export type Mutable<Type> = {
	-readonly [Property in keyof Type]: Type[Property]
}
