import { BridgeProtocolError, requireRyuBridge } from "./bridge.ts";

export const HELP_CENTER_SPACE_STORAGE_KEY = "help-center.space_id";

const HELP_CENTER_SPACE_DESCRIPTION =
	"Support tickets and knowledge articles managed by Ryu.";

export async function ensureHelpCenterSpace(): Promise<string> {
	const bridge = requireRyuBridge();
	const storedValue: unknown = await bridge.storage.get({
		key: HELP_CENTER_SPACE_STORAGE_KEY,
	});
	if (typeof storedValue === "string" && storedValue.trim().length > 0) {
		return storedValue.trim();
	}

	const createdSpaceId: unknown = await bridge.spaces.ensureSpace({
		name: "Help Center",
		description: HELP_CENTER_SPACE_DESCRIPTION,
	});
	if (
		typeof createdSpaceId !== "string" ||
		createdSpaceId.trim().length === 0
	) {
		throw new BridgeProtocolError(
			"The Space bridge did not return a Help Center Space id"
		);
	}
	const spaceId = createdSpaceId.trim();
	await bridge.storage.set({
		key: HELP_CENTER_SPACE_STORAGE_KEY,
		value: spaceId,
	});
	return spaceId;
}

export async function readHelpCenterStorage(
	key: string
): Promise<string | null> {
	if (key.trim().length === 0) {
		throw new BridgeProtocolError("A storage key is required");
	}
	const value: unknown = await requireRyuBridge().storage.get({ key });
	return typeof value === "string" ? value : null;
}

export async function writeHelpCenterStorage(
	key: string,
	value: string
): Promise<void> {
	if (key.trim().length === 0) {
		throw new BridgeProtocolError("A storage key is required");
	}
	await requireRyuBridge().storage.set({ key, value });
}
