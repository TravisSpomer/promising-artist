import type { CollaborationOptions, CollabMessage, CollabMessageHandler, CollabCleanupFunction } from "./collab.js"

/** A set of options to pass to PromisingArtist.collab if you're calling it from a Figma plugin's UI and want to talk to your plugin code. */
export const FigmaPluginUI: CollaborationOptions =
{
	name: "UI",
	toSendMessage(pluginMessage: CollabMessage): void
	{
		parent.postMessage({ pluginMessage: pluginMessage }, "*")
	},
	toHandleMessage(callMe: CollabMessageHandler): CollabCleanupFunction
	{
		onmessage = ev => callMe(ev.data.pluginMessage)
		return function cleanup(): void
		{
			onmessage = null
		}
	},
}

/** A set of options to pass to PromisingArtist.collab if you're calling it from Figma plugin code and want to talk to your plugin's UI. */
export const FigmaPlugin: CollaborationOptions =
{
	name: "Plugin",
	toSendMessage(pluginMessage: CollabMessage): void
	{
		figma.ui.postMessage(pluginMessage)
	},
	toHandleMessage(callMe: CollabMessageHandler): CollabCleanupFunction
	{
		figma.ui.onmessage = callMe
		return function cleanup(): void
		{
			figma.ui.onmessage = undefined
		}
	},
}
