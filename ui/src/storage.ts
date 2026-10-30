import { BridgeProtocolError, requireRyuBridge } from "./bridge.ts";
import { nonEmptyTextSchema } from "./schemas.ts";

export const HELP_CENTER_SPACE_STORAGE_KEY = "help-center.space_id";

const HELP_CENTER_SPACE_DESCRIPTION =
	"Support tickets and knowledge articles managed by Ryu.";

export async function ensureHelpCenterSpace(): Promise<string> {
	const bridge = requireRyuBridge();
	const storedValue = await bridge.storage.get({
		key: HELP_CENTER_SPACE_STORAGE_KEY,
	});
	const stored = nonEmptyTextSchema.safeParse(storedValue);
	if (stored.success) {
		return stored.data.trim();
	}

	const createdSpaceId = await bridge.spaces.ensureSpace({
		name: "Help Center",
		description: HELP_CENTER_SPACE_DESCRIPTION,
	});
	const created = nonEmptyTextSchema.safeParse(createdSpaceId);
	if (!created.success) {
		throw new BridgeProtocolError(
			"The Space bridge did not return a Help Center Space id"
		);
	}
	const spaceId = created.data.trim();
	await bridge.storage.set({
		key: HELP_CENTER_SPACE_STORAGE_KEY,
		value: spaceId,
	});
	return spaceId;
}
