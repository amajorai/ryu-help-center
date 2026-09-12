import { expect, test } from "bun:test";
import { parseClassificationResponse, parseReplySuggestion } from "./ai.ts";

test("parses strict classification output and clamps confidence", () => {
	expect(
		parseClassificationResponse(
			JSON.stringify({
				topic: "Billing",
				priority: "urgent",
				sentiment: "negative",
				confidence: 4,
				rationale: "Payment failed",
			})
		)
	).toEqual({
		topic: "Billing",
		priority: "urgent",
		sentiment: "negative",
		confidence: 1,
		rationale: "Payment failed",
	});
});

test("does not turn malformed model output into a draft", () => {
	expect(() => parseReplySuggestion("{}")).toThrow("reply suggestion");
});
