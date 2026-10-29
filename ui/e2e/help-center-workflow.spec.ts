import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { z } from "zod";
import type { RyuBridge } from "../src/ryu.d.ts";
import { articleDocumentSchema, ticketDocumentSchema } from "../src/schemas.ts";
import type { ArticleDocument, TicketDocument } from "../src/types.ts";

type FixtureTicket = TicketDocument;
type FixtureArticle = ArticleDocument;
type HelpCenterHostInput =
	| Parameters<RyuBridge["model"]["complete"]>[0]
	| Parameters<RyuBridge["spaces"]["ensureSpace"]>[0]
	| Parameters<RyuBridge["spaces"]["search"]>[0]
	| Parameters<RyuBridge["spaces"]["createDoc"]>[0]
	| Parameters<RyuBridge["spaces"]["getDoc"]>[0]
	| Parameters<RyuBridge["spaces"]["updateDoc"]>[0]
	| Parameters<RyuBridge["spaces"]["listDocs"]>[0]
	| Parameters<RyuBridge["spaces"]["deleteDoc"]>[0]
	| Parameters<RyuBridge["storage"]["get"]>[0]
	| Parameters<RyuBridge["storage"]["set"]>[0];
const createDocumentInputSchema = z.object({
	space_id: z.string(),
	title: z.string(),
});
const updateDocumentInputSchema = z.object({
	doc_id: z.string(),
	source: z.string(),
	title: z.string(),
});
const documentIdInputSchema = z.object({ doc_id: z.string() });
const searchInputSchema = z.object({
	space_id: z.string(),
	query: z.string(),
	limit: z.number(),
});
const modelInputSchema = z.object({ prompt: z.string() });

interface FixtureDocument {
	id: string;
	kind: "document";
	source: string;
	title: string;
	updated_at: number;
}

interface HostCall {
	method: string;
	payload: HelpCenterHostInput;
}

interface HelpCenterFixture {
	calls: HostCall[];
	docs: Map<string, FixtureDocument>;
	failNext: Record<string, number>;
	nextId: number;
	storage: Map<string, string>;
}

declare global {
	interface Window {
		__helpCenterTestHost?: HelpCenterFixture;
	}
}

const TIMESTAMP = "2026-08-24T08:00:00.000Z";

function ticket(
	id: string,
	subject: string,
	status: FixtureTicket["status"],
	assigneeId: string | null,
	priority: FixtureTicket["priority"] = "normal"
): FixtureTicket {
	const requester =
		id === "ticket-export"
			? {
					avatarSeed: "maya",
					company: "Northstar Labs",
					email: "maya@example.com",
					id: "user-maya",
					name: "Maya Chen",
				}
			: {
					avatarSeed: "jon",
					company: "Rookery Studio",
					email: "jon@example.com",
					id: `user-${id}`,
					name: "Jon Bell",
				};
	return {
		aiConfidence: id === "ticket-export" ? 0.84 : null,
		aiState: id === "ticket-export" ? "suggested" : "none",
		assigneeId,
		channel: "in-app",
		createdAt: TIMESTAMP,
		id,
		linkedArticleIds: id === "ticket-export" ? ["article-export"] : [],
		messages: [
			{
				author: "customer",
				authorName: requester.name,
				body:
					id === "ticket-export"
						? "The report export spins and no file downloads."
						: `Please review ${subject}.`,
				createdAt: TIMESTAMP,
				id: `${id}-message-1`,
				internal: false,
			},
		],
		priority,
		requester,
		schemaVersion: 1,
		sentiment: id === "ticket-export" ? "negative" : null,
		snoozedUntil: status === "snoozed" ? "2026-08-25T08:00:00.000Z" : null,
		status,
		subject,
		tags: id === "ticket-export" ? ["reports", "exports"] : [id],
		topic: id === "ticket-export" ? "Reports" : null,
		type: "help-center/ticket",
		updatedAt: TIMESTAMP,
	};
}

function article(
	id: string,
	title: string,
	status: FixtureArticle["status"]
): FixtureArticle {
	return {
		body: `Approved guidance for ${title.toLocaleLowerCase()}.`,
		createdAt: TIMESTAMP,
		id,
		schemaVersion: 1,
		sourceTicketIds: ["ticket-export"],
		status,
		tags: ["reports", "exports"],
		title,
		type: "help-center/article",
		updatedAt: TIMESTAMP,
		usageCount: 4,
	};
}

function documentFor(
	document: FixtureTicket | FixtureArticle
): FixtureDocument {
	return {
		id: document.id,
		kind: "document",
		source: JSON.stringify(document),
		title:
			document.type === "help-center/ticket"
				? document.subject
				: document.title,
		updated_at: 1_787_560_800_000,
	};
}

function initialDocuments(): FixtureDocument[] {
	return [
		documentFor(
			ticket("ticket-export", "Cannot export a report", "open", null, "urgent")
		),
		documentFor(
			ticket("ticket-waiting", "Invite a teammate", "waiting", "ryu-operator")
		),
		documentFor(
			ticket("ticket-snoozed", "Check a saved reply", "snoozed", null)
		),
		documentFor(
			ticket(
				"ticket-resolved",
				"Model recommendation worked",
				"resolved",
				"ryu-operator"
			)
		),
		documentFor(
			article("article-export", "Exporting a report from Ryu", "published")
		),
		documentFor(article("article-draft", "Draft: workspace access", "draft")),
	];
}

async function installHostFixture(
	page: Page,
	options: {
		documents?: FixtureDocument[];
		failNext?: Record<string, number>;
		view?: string;
	} = {}
): Promise<void> {
	await page.addInitScript(
		({ documents, failNext, view }) => {
			const fixture: HelpCenterFixture = {
				calls: [],
				docs: new Map(documents.map((document) => [document.id, document])),
				failNext: { ...failNext },
				nextId: 0,
				storage: new Map<string, string>([
					[
						"help-center.space_id",
						documents.length === 0 ? "" : "space-help-center",
					],
				]),
			};
			const record = (method: string, payload: HelpCenterHostInput) => {
				fixture.calls.push({ method, payload });
			};
			const maybeFail = (method: string) => {
				const remaining = fixture.failNext[method] ?? 0;
				if (remaining < 1) {
					return;
				}
				fixture.failNext[method] = remaining - 1;
				throw new Error(`Fixture failure: ${method}`);
			};
			window.__helpCenterTestHost = fixture;
			window.ryu = {
				context: { view },
				model: {
					complete: async (input) => {
						record("model.complete", input);
						maybeFail("model.complete");
						if (
							input.prompt.startsWith("Classify this Ryu Help Center ticket.")
						) {
							return JSON.stringify({
								confidence: 0.93,
								priority: "high",
								rationale: "The customer cannot complete a report export.",
								sentiment: "negative",
								topic: "Reports",
							});
						}
						const escalation = input.prompt.includes("Question: account");
						return JSON.stringify({
							reply: input.prompt.startsWith("Draft a reply")
								? "Fixture draft: I checked the report export guidance."
								: "Fixture answer: open Reports, choose Export, and keep the tab open.",
							citedArticleIds: ["article-export"],
							shouldEscalate: escalation,
							uncertainty: escalation
								? "An operator must verify the account change."
								: null,
						});
					},
				},
				spaces: {
					ensureSpace: async (input) => {
						record("spaces.ensureSpace", input);
						maybeFail("spaces.ensureSpace");
						return "space-help-center";
					},
					search: async (input) => {
						record("spaces.search", input);
						maybeFail("spaces.search");
						return [
							{
								chunk_id: "article-export-chunk-1",
								content:
									"Choose Export and keep the tab open until the download is ready.",
								distance: 0.08,
								document_id: "article-export",
							},
						].slice(0, input.limit ?? 24);
					},
					createDoc: async (input) => {
						record("spaces.createDoc", input);
						maybeFail("spaces.createDoc");
						fixture.nextId += 1;
						const id = `created-doc-${fixture.nextId}`;
						fixture.docs.set(id, {
							id,
							kind: "document",
							source: "",
							title: input.title,
							updated_at: Date.now(),
						});
						return id;
					},
					getDoc: async ({ doc_id }) => {
						record("spaces.getDoc", { doc_id });
						maybeFail("spaces.getDoc");
						const document = fixture.docs.get(doc_id);
						return document
							? {
									id: document.id,
									kind: document.kind,
									source: document.source,
									title: document.title,
								}
							: null;
					},
					listDocs: async (input) => {
						record("spaces.listDocs", input);
						maybeFail("spaces.listDocs");
						return [...fixture.docs.values()].map(
							({ id, title, updated_at }) => ({
								id,
								title,
								updated_at,
							})
						);
					},
					updateDoc: async ({ doc_id, source, title }) => {
						record("spaces.updateDoc", { doc_id, source, title });
						maybeFail("spaces.updateDoc");
						const current = fixture.docs.get(doc_id);
						if (!current) {
							throw new Error(`Fixture document not found: ${doc_id}`);
						}
						fixture.docs.set(doc_id, {
							...current,
							source,
							title: title ?? current.title,
							updated_at: Date.now(),
						});
					},
					deleteDoc: async ({ doc_id }) => {
						record("spaces.deleteDoc", { doc_id });
						maybeFail("spaces.deleteDoc");
						fixture.docs.delete(doc_id);
					},
				},
				storage: {
					get: async (input) => {
						record("storage.get", input);
						maybeFail("storage.get");
						return fixture.storage.get(input.key) ?? null;
					},
					set: async (input) => {
						record("storage.set", input);
						maybeFail("storage.set");
						fixture.storage.set(input.key, input.value);
					},
				},
			};
		},
		{
			documents: options.documents ?? initialDocuments(),
			failNext: options.failNext ?? {},
			view: options.view ?? "inbox",
		}
	);
}

async function openApp(
	page: Page,
	view: string,
	options: {
		documents?: FixtureDocument[];
		failNext?: Record<string, number>;
	} = {}
): Promise<void> {
	await installHostFixture(page, { ...options, view });
	await page.goto("/");
	await expect(page.getByTestId("help-center-app")).toBeVisible();
	await expect(
		page.getByRole("heading", {
			name:
				view === "tickets"
					? "Tickets"
					: view === "knowledge"
						? "Knowledge"
						: view === "agent"
							? "Agent"
							: view === "insights" || view === "overview"
								? "Insights"
								: "Inbox",
		})
	).toBeVisible();
}

async function fixtureCalls(page: Page, method: string): Promise<HostCall[]> {
	return page.evaluate(
		(targetMethod) =>
			(window.__helpCenterTestHost?.calls ?? []).filter(
				(call) => call.method === targetMethod
			),
		method
	);
}

async function savedDocument<T>(
	page: Page,
	id: string,
	schema: z.ZodType<T>
): Promise<T | null> {
	const source = await page.evaluate(
		(documentId) =>
			window.__helpCenterTestHost?.docs.get(documentId)?.source ?? null,
		id
	);
	return source ? schema.parse(JSON.parse(source)) : null;
}

async function selectTicketFilter(
	page: Page,
	queue: Locator,
	label: string
): Promise<void> {
	const tab = queue.getByRole("tab", { name: label, exact: true });
	if ((await tab.count()) > 0) {
		await tab.click();
		return;
	}
	const moreTabs = queue.getByRole("button", { name: /Show \d+ more tabs/ });
	await moreTabs.click();
	await page.getByRole("option", { name: new RegExp(label) }).click();
}

async function saveScreenshot(page: Page, name: string): Promise<void> {
	const configured = process.env.RYU_APPS_STORE_PROOF_DIR;
	const destination = configured
		? path.join(configured, name)
		: path.join(import.meta.dirname, "evidence", name);
	await mkdir(path.dirname(destination), { recursive: true });
	await page.screenshot({
		animations: "disabled",
		fullPage: true,
		path: destination,
	});
}

test("ticket subjects and requester text remain readable in the production narrow sidebar", async ({
	page,
}) => {
	await openApp(page, "inbox");
	const row = page
		.getByTestId("help-center-ticket-row")
		.filter({ hasText: "Cannot export a report" });
	const title = row.locator(".ryu-app-list__item-title");
	const requester = row.getByTestId("help-center-ticket-requester");
	await expect(title).toHaveText("Cannot export a report");
	await expect(requester).toContainText("Maya");
	const rowBox = await row.boundingBox();
	expect(rowBox).not.toBeNull();
	if (!rowBox) {
		throw new Error("Ticket row has no rendered geometry");
	}
	// The actual Inbox sidebar is 304px. Do not resize it into a roomy fixture.
	expect(rowBox.width).toBeGreaterThanOrEqual(240);
	expect(rowBox.width).toBeLessThanOrEqual(304);
	for (const text of [title, requester]) {
		await expect(text).toBeVisible();
		const box = await text.boundingBox();
		expect(box, "ticket text has rendered geometry").not.toBeNull();
		if (!box) {
			throw new Error("Ticket text has no rendered geometry");
		}
		expect(
			box.width,
			"badges must not consume the readable text column"
		).toBeGreaterThanOrEqual(160);
		expect(box.height).toBeGreaterThan(10);
		expect(box.x).toBeGreaterThanOrEqual(rowBox.x);
		expect(box.x + box.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
		expect(box.y).toBeGreaterThanOrEqual(rowBox.y);
		expect(box.y + box.height).toBeLessThanOrEqual(
			rowBox.y + rowBox.height + 1
		);
	}
	const accessories = row.locator(".ryu-app-list__item-accessories");
	await expect(accessories).toContainText("Needs reply");
	const accessoriesBox = await accessories.boundingBox();
	const requesterBox = await requester.boundingBox();
	const titleBox = await title.boundingBox();
	expect(accessoriesBox).not.toBeNull();
	if (!(accessoriesBox && requesterBox && titleBox)) {
		throw new Error("Ticket metadata has no rendered geometry");
	}
	expect(
		accessoriesBox.width,
		"metadata uses the readable text column"
	).toBeGreaterThanOrEqual(160);
	expect(
		accessoriesBox.x,
		"metadata starts under the subject, not the avatar"
	).toBeGreaterThanOrEqual(titleBox.x);
	for (const label of [
		accessories.locator("time"),
		accessories.getByText("Needs reply", { exact: true }),
	]) {
		const labelBox = await label.boundingBox();
		expect(labelBox).not.toBeNull();
		if (!labelBox) {
			throw new Error("Ticket metadata label has no geometry");
		}
		expect(
			labelBox.height,
			"metadata labels must not wrap one word per line"
		).toBeLessThanOrEqual(20);
	}
	expect(accessoriesBox.y).toBeGreaterThanOrEqual(
		requesterBox.y + requesterBox.height
	);
	expect(accessoriesBox.x).toBeGreaterThanOrEqual(rowBox.x);
	expect(accessoriesBox.x + accessoriesBox.width).toBeLessThanOrEqual(
		rowBox.x + rowBox.width + 1
	);
	await row.click();
	await expect(
		page.getByRole("heading", { name: "Cannot export a report" })
	).toBeVisible();
	await saveScreenshot(page, "help-center-readable-ticket-sidebar.png");
});

test("filters inbox records, selects a ticket, and creates a durable ticket", async ({
	page,
}) => {
	/*
	 * Selecting the active queue ticket renders its matching conversation and customer context.
	 * Ticket row selection changes the conversation to the selected durable ticket.
	 * Requester email search narrows the queue to the matching ticket and clearing restores the queue.
	 * Each queue-filter value produces its expected ticket set, including resolved records.
	 * Clicking each rendered filter tab exposes only the matching visible ticket rows.
	 * Matching inbox rows are visible and selecting one opens its conversation.
	 * New ticket creates and reads back the complete ticket document through the host.
	 */
	await openApp(page, "inbox");
	const queue = page.getByTestId("help-center-queue");
	const rows = page.getByTestId("help-center-ticket-row");

	// Inbox selection routes the selected row into its rendered conversation.
	const selectedTicket = rows.filter({ hasText: "Cannot export a report" });
	await selectedTicket.click();
	await expect(
		page.getByRole("heading", { name: "Cannot export a report" })
	).toBeVisible();
	await expect(page.getByTestId("help-center-customer-context")).toContainText(
		"maya@example.com"
	);

	// Search uses ticket subject, requester, tags, and message text in the active queue.
	const ticketSearch = queue.getByRole("textbox", {
		name: "Search Help Center tickets",
	});
	await ticketSearch.fill("maya@example.com");
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText("Cannot export a report");
	await ticketSearch.fill("");

	// Every visible queue filter produces the matching ticket set, including resolved history.
	const expectedByFilter = {
		"My queue": ["Invite a teammate"],
		Unassigned: ["Cannot export a report", "Check a saved reply"],
		Open: ["Cannot export a report"],
		Waiting: ["Invite a teammate"],
		Snoozed: ["Check a saved reply"],
		Resolved: ["Model recommendation worked"],
	};
	for (const [label, subjects] of Object.entries(expectedByFilter)) {
		await selectTicketFilter(page, queue, label);
		await expect(rows).toHaveCount(subjects.length);
		for (const subject of subjects) {
			await expect(rows.filter({ hasText: subject })).toBeVisible();
		}
	}
	await selectTicketFilter(page, queue, "All");
	await expect(rows).toHaveCount(3);
	await expect(
		rows.filter({ hasText: "Model recommendation worked" })
	).toHaveCount(0);

	// New ticket persists the exact Help Center document through createDoc + updateDoc.
	await page.getByRole("button", { name: "New ticket", exact: true }).click();
	const created = await expect
		.poll(async () => {
			const calls = await fixtureCalls(page, "spaces.createDoc");
			return calls.length;
		})
		.toBe(1)
		.then(() => fixtureCalls(page, "spaces.createDoc"));
	const createPayload = createDocumentInputSchema.parse(created[0]?.payload);
	expect(createPayload).toEqual({
		space_id: "space-help-center",
		title: "New support question",
	});
	await expect(
		page.getByRole("heading", { name: "New support question" })
	).toBeVisible();
	const updated = await expect
		.poll(async () => (await fixtureCalls(page, "spaces.updateDoc")).length)
		.toBe(1)
		.then(() => fixtureCalls(page, "spaces.updateDoc"));
	const createdId = created[0] ? "created-doc-1" : "";
	const ticketWrite = updateDocumentInputSchema.parse(updated[0]?.payload);
	expect(ticketWrite.doc_id).toBe(createdId);
	expect(ticketWrite.title).toBe("New support question");
	const createdTicket = ticketDocumentSchema.parse(
		JSON.parse(ticketWrite.source)
	);
	expect(createdTicket).toMatchObject({
		subject: "New support question",
		status: "open",
		requester: { email: "customer@example.com", name: "New customer" },
		type: "help-center/ticket",
	});
	expect(await savedDocument(page, createdId, ticketDocumentSchema)).toEqual(
		createdTicket
	);
});

test("triages, reviews, replies, adds an internal note, resolves, and reopens a ticket", async ({
	page,
}) => {
	/*
	 * Run triage sends the exact Space search and classification result to durable ticket storage.
	 * Review, Resolve, and Reopen each round-trip the ticket state through the Space host.
	 * Draft with AI fills the composer from the fixture model and preserves the human-review guardrail.
	 * Reply mode records an agent message with internal=false and the exact reply body.
	 * Internal note mode records the exact note as a system message with internal=true.
	 * Composer text is saved exactly once with the selected reply or internal-note visibility.
	 * Add reply and Add note append separate persisted messages without external delivery.
	 * Browse opens Knowledge from the active ticket conversation.
	 */
	await openApp(page, "tickets");
	const ticketRow = page
		.getByTestId("help-center-ticket-row")
		.filter({ hasText: "Cannot export a report" });
	await ticketRow.click();
	const ticketHeading = page.getByRole("heading", {
		name: "Cannot export a report",
	});
	await expect(ticketHeading).toBeVisible();

	// The triage action retrieves knowledge, sends the ticket context to the model, and persists its result.
	await page.getByRole("button", { name: "Run triage" }).click();
	await expect
		.poll(async () => (await fixtureCalls(page, "model.complete")).length)
		.toBe(1);
	const searchCall = searchInputSchema.parse(
		(await fixtureCalls(page, "spaces.search"))[0]?.payload
	);
	expect(searchCall).toEqual({
		limit: 5,
		query: "Cannot export a report reports exports",
		space_id: "space-help-center",
	});
	const classification = await expect
		.poll(async () =>
			savedDocument(page, "ticket-export", ticketDocumentSchema)
		)
		.toMatchObject({
			aiConfidence: 0.93,
			aiState: "suggested",
			priority: "high",
			sentiment: "negative",
			topic: "Reports",
		})
		.then(() => savedDocument(page, "ticket-export", ticketDocumentSchema));
	expect(classification?.updatedAt).not.toBe(TIMESTAMP);

	// Reviewing an AI suggestion changes ownership before resolution; Reopen restores the active state.
	const ribbon = page.getByTestId("help-center-resolution-ribbon");
	await ribbon.getByRole("button", { name: "Review suggestion" }).click();
	await expect(ribbon).toContainText("Human working");
	await expect
		.poll(async () =>
			savedDocument(page, "ticket-export", ticketDocumentSchema)
		)
		.toMatchObject({ aiState: "human-reviewed", status: "open" });
	await ribbon.getByRole("button", { name: "Resolve ticket" }).click();
	await expect(ribbon).toContainText("Resolved");
	await expect
		.poll(async () =>
			savedDocument(page, "ticket-export", ticketDocumentSchema)
		)
		.toMatchObject({ status: "resolved" });
	await ribbon.getByRole("button", { name: "Reopen ticket" }).click();
	await expect(ribbon).toContainText("Human working");
	await expect
		.poll(async () =>
			savedDocument(page, "ticket-export", ticketDocumentSchema)
		)
		.toMatchObject({ status: "open" });

	// Draft with AI is still a local human-reviewed draft; reply and note writes remain distinct records.
	const composer = page.getByTestId("help-center-composer");
	await composer.getByRole("button", { name: "Draft with AI" }).click();
	const replyBox = composer.getByRole("textbox", { name: "Local reply" });
	await expect(replyBox).toHaveValue(
		"Fixture draft: I checked the report export guidance."
	);
	const modelCalls = await fixtureCalls(page, "model.complete");
	expect(modelCalls).toHaveLength(2);
	expect(modelInputSchema.parse(modelCalls[1]?.payload).prompt).toContain(
		"Do not invent account changes or claim external delivery."
	);
	const reply = "I checked the local export job and will follow up here.";
	await replyBox.fill(reply);
	await page.evaluate(() => {
		if (window.__helpCenterTestHost) {
			window.__helpCenterTestHost.failNext["spaces.updateDoc"] = 1;
		}
	});
	await composer.getByRole("button", { name: "Add reply" }).click();
	await expect(page.getByTestId("help-center-conversation")).toContainText(
		reply
	);
	await expect(page.getByRole("alert")).toContainText(
		"Fixture failure: spaces.updateDoc"
	);
	await expect(
		savedDocument(page, "ticket-export", ticketDocumentSchema)
	).resolves.toMatchObject({
		aiState: "human-reviewed",
		messages: [{ id: "ticket-export-message-1" }],
	});
	await expect(replyBox).toHaveValue(reply);
	await composer.getByRole("button", { name: "Add reply" }).click();
	const persistedReply = (
		await savedDocument(page, "ticket-export", ticketDocumentSchema)
	)?.messages.at(-1);
	expect(persistedReply).toMatchObject({
		author: "agent",
		body: reply,
		internal: false,
	});
	await composer.getByRole("button", { name: "Internal note" }).click();
	const note = "Verify the export job before the next customer update.";
	await composer.getByRole("textbox", { name: "Internal note" }).fill(note);
	await composer.getByRole("button", { name: "Add note" }).click();
	await expect(page.getByTestId("help-center-conversation")).toContainText(
		note
	);
	const persistedNote = (
		await savedDocument(page, "ticket-export", ticketDocumentSchema)
	)?.messages.at(-1);
	expect(persistedNote).toMatchObject({
		author: "system",
		body: note,
		internal: true,
	});

	await saveScreenshot(page, "help-center-ticket-workflow.png");

	// Browse leaves the ticket workflow for the real Knowledge view.
	await page.getByRole("button", { name: "Browse" }).click();
	await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
});

test("creates, searches, filters, and retries durable knowledge article edits", async ({
	page,
}) => {
	/*
	 * New article requires both title and body before a createDoc request is made.
	 * Close removes the unsaved editor and leaves the Space without a created draft.
	 * The saved article title is identical in the Space title field and serialized article.
	 * The saved article body and status survive host readback after create and edit.
	 * Published create and draft edit statuses persist and drive the rendered status filter.
	 * Knowledge search finds the persisted article by title and clearing restores matching status results.
	 * The status filter hides a published result from Drafts and restores it under Published.
	 * Edit reopens the persisted article with its saved title, body, and status.
	 * A rejected article update leaves the old card visible and a retry saves the same id.
	 */
	await openApp(page, "knowledge");
	await page.getByRole("button", { name: "New article" }).click();
	const title = page.getByLabel("Article title");
	const body = page.getByLabel("Article body");
	const saveButton = page.getByRole("button", { name: "Save article" });

	// Empty required fields are rejected in the rendered editor without a host write.
	await saveButton.click();
	await expect(page.getByRole("alert")).toContainText(
		"Add a title and body before saving the article."
	);
	expect(await fixtureCalls(page, "spaces.createDoc")).toHaveLength(0);

	// Close discards an unsaved draft; reopening creates a new, independently validated draft.
	await page.getByRole("button", { name: "Close" }).click();
	await expect(title).toHaveCount(0);
	await page.getByRole("button", { name: "New article" }).click();
	await title.fill("Recover a delayed export");
	await body.fill("Open Reports, retry the export, and wait for the download.");
	await page.getByLabel("Article status").selectOption("published");
	await saveButton.click();
	const createCall = await expect
		.poll(async () => (await fixtureCalls(page, "spaces.createDoc")).length)
		.toBe(1)
		.then(() => fixtureCalls(page, "spaces.createDoc"));
	expect(createCall[0]?.payload).toEqual({
		space_id: "space-help-center",
		title: "Recover a delayed export",
	});
	await expect(
		page.getByText("Recover a delayed export", { exact: true })
	).toBeVisible();
	const createId = "created-doc-1";
	const createWrite = updateDocumentInputSchema.parse(
		(await fixtureCalls(page, "spaces.updateDoc"))[0]?.payload
	);
	expect(createWrite.doc_id).toBe(createId);
	expect(JSON.parse(createWrite.source)).toMatchObject({
		body: "Open Reports, retry the export, and wait for the download.",
		status: "published",
		title: "Recover a delayed export",
		type: "help-center/article",
	});

	// Search and status filtering operate on saved article title/body/status.
	const knowledge = page.getByTestId("help-center-knowledge");
	const search = knowledge.getByRole("textbox", {
		name: "Search Help Center knowledge",
	});
	await search.fill("delayed export");
	await expect(
		page.getByText("Recover a delayed export", { exact: true })
	).toBeVisible();
	await knowledge.getByLabel("Filter knowledge articles").selectOption("draft");
	await expect(
		page.getByText("Recover a delayed export", { exact: true })
	).toHaveCount(0);
	await knowledge
		.getByLabel("Filter knowledge articles")
		.selectOption("published");
	await expect(
		page.getByText("Recover a delayed export", { exact: true })
	).toBeVisible();
	await search.fill("");

	// An update rejection keeps the editor open and the persisted card unchanged; retry saves the same id.
	const createdArticle = page
		.locator("article")
		.filter({ hasText: "Recover a delayed export" });
	await createdArticle
		.getByRole("button", { name: "Edit", exact: true })
		.click();
	await title.fill("Recover a stalled export");
	await body.fill("Retry the export from Reports, then keep the tab open.");
	await page.getByLabel("Article status").selectOption("draft");
	await page.evaluate(() => {
		if (window.__helpCenterTestHost) {
			window.__helpCenterTestHost.failNext["spaces.updateDoc"] = 1;
		}
	});
	await saveButton.click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture failure: spaces.updateDoc"
	);
	await expect(createdArticle).toContainText("Recover a delayed export");
	await expect(title).toHaveValue("Recover a stalled export");
	await expect(
		savedDocument(page, createId, articleDocumentSchema)
	).resolves.toMatchObject({
		status: "published",
		title: "Recover a delayed export",
	});
	await saveButton.click();
	await knowledge.getByLabel("Filter knowledge articles").selectOption("draft");
	await expect(
		page.getByText("Recover a stalled export", { exact: true })
	).toBeVisible();
	await expect(
		page.getByText("Recover a delayed export", { exact: true })
	).toHaveCount(0);
	const saved = await savedDocument(page, createId, articleDocumentSchema);
	expect(saved).toMatchObject({
		body: "Retry the export from Reports, then keep the tab open.",
		status: "draft",
		title: "Recover a stalled export",
	});
	const updateCalls = await fixtureCalls(page, "spaces.updateDoc");
	expect(
		updateCalls.map((call) => documentIdInputSchema.parse(call.payload).doc_id)
	).toEqual([createId, createId, createId]);
});

test("uses agent tone and guardrails for source-backed preview and retries retrieval failures", async ({
	page,
}) => {
	/*
	 * The model request receives the tone selected in the rendered Agent settings.
	 * The model request receives the guardrail text selected in the rendered Agent settings.
	 * Enter submits the trimmed customer question and renders the answer with its cited source.
	 * Ask surfaces retrieval failure without calling the model, then retries into a human-handoff answer.
	 */
	await openApp(page, "agent");
	await page.getByLabel("Tone").fill("warm and direct");
	await page
		.getByLabel("Guardrails")
		.fill("Never promise an account change without an operator.");
	const question = page.getByRole("textbox", {
		name: "Customer preview question",
	});
	await question.fill("How can I download an exported report?");
	await question.press("Enter");
	await expect(page.getByText(/Fixture answer: open Reports/)).toBeVisible();
	await expect(
		page.getByText("Source: Exporting a report from Ryu")
	).toBeVisible();
	const searchCall = searchInputSchema.parse(
		(await fixtureCalls(page, "spaces.search"))[0]?.payload
	);
	expect(searchCall).toEqual({
		limit: 5,
		query: "How can I download an exported report?",
		space_id: "space-help-center",
	});
	const modelCall = modelInputSchema.parse(
		(await fixtureCalls(page, "model.complete"))[0]?.payload
	);
	expect(modelCall.prompt).toContain('"tone":"warm and direct"');
	expect(modelCall.prompt).toContain(
		'"guardrails":"Never promise an account change without an operator."'
	);
	expect(modelCall.prompt).toContain('"documentId":"article-export"');
	await expect(page.getByText(/Fixture answer: open Reports/)).toBeVisible();

	// Retrieval failure is visible and does not call the model; retry succeeds and renders escalation guidance.
	await page.evaluate(() => {
		if (window.__helpCenterTestHost) {
			window.__helpCenterTestHost.failNext["spaces.search"] = 1;
		}
	});
	await question.fill("account access after a failed reset");
	await page.getByRole("button", { name: "Ask", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Help Center knowledge retrieval failed"
	);
	expect(await fixtureCalls(page, "model.complete")).toHaveLength(1);
	await page.getByRole("button", { name: "Ask", exact: true }).click();
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(page.getByText("Human handoff recommended")).toBeVisible();
	await expect(
		page.getByText(/An operator must verify the account change\./)
	).toBeVisible();
	expect(await fixtureCalls(page, "model.complete")).toHaveLength(2);
});

test("renders Overview and Insights as current Space metrics", async ({
	page,
}) => {
	await openApp(page, "overview");
	await expect(
		page.getByText("Open tickets", { exact: true }).locator("..")
	).toContainText("3");
	await expect(
		page.getByText("Resolved", { exact: true }).locator("..")
	).toContainText("1");
	await expect(page.getByText("Top topics", { exact: true })).toBeVisible();
	await expect(
		page.getByText("Knowledge usage", { exact: true })
	).toBeVisible();

	await openApp(page, "insights");
	await expect(
		page.getByText("Open tickets", { exact: true }).locator("..")
	).toContainText("3");
	await expect(
		page.getByText("0 unanswered questions need attention.")
	).toBeVisible();
});

test("retries an empty Space activation and seeds linked sample records", async ({
	page,
}) => {
	/*
	 * Retry connection repeats Space creation before activation proceeds.
	 * Loading samples persists all six records and remaps each ticket's article references.
	 */
	await installHostFixture(page, {
		documents: [],
		failNext: { "spaces.ensureSpace": 1 },
		view: "inbox",
	});
	await page.goto("/");

	// A failed initial Space creation must stay visible as a retryable activation state.
	await expect(page.getByRole("alert")).toContainText(
		"Fixture failure: spaces.ensureSpace"
	);
	await page.getByRole("button", { name: "Retry connection" }).click();
	// The shared Empty state titles its panel with a styled `empty-title` slot, not a heading element.
	await expect(
		page.locator('[data-slot="empty-title"]', { hasText: "No tickets yet" })
	).toBeVisible();
	expect(await fixtureCalls(page, "spaces.ensureSpace")).toHaveLength(2);

	// Loading samples creates each article first, then remaps ticket references to the new article ids.
	await page.getByRole("button", { name: "Load sample workspace" }).click();
	await expect(page.getByTestId("help-center-ticket-row")).toHaveCount(2);
	const created = await fixtureCalls(page, "spaces.createDoc");
	const updated = await fixtureCalls(page, "spaces.updateDoc");
	expect(created).toHaveLength(6);
	expect(updated).toHaveLength(6);
	const persistedSources = await page.evaluate(() =>
		[...(window.__helpCenterTestHost?.docs.values() ?? [])]
			.filter((document) => document.source)
			.map((document) => document.source)
	);
	const persisted = persistedSources.map((source) =>
		z
			.union([ticketDocumentSchema, articleDocumentSchema])
			.parse(JSON.parse(source))
	);
	expect(persisted).toHaveLength(6);
	const exportArticle = persisted.find(
		(document): document is FixtureArticle =>
			document.type === "help-center/article" &&
			document.title === "Exporting a report from Ryu"
	);
	const exportTicket = persisted.find(
		(document): document is FixtureTicket =>
			document.type === "help-center/ticket" &&
			document.subject === "Cannot export a report"
	);
	expect(exportArticle).toBeDefined();
	expect(exportTicket?.linkedArticleIds).toEqual([exportArticle?.id]);
});

test("creates the first ticket from activation and reports host errors before retrying", async ({
	page,
}) => {
	/*
	 * Retrying first-ticket creation persists one complete ticket after the rejected attempt.
	 */
	await installHostFixture(page, { documents: [], view: "inbox" });
	await page.goto("/");
	// The shared Empty state titles its panel with a styled `empty-title` slot, not a heading element.
	await expect(
		page.locator('[data-slot="empty-title"]', { hasText: "No tickets yet" })
	).toBeVisible();
	await page.evaluate(() => {
		if (window.__helpCenterTestHost) {
			window.__helpCenterTestHost.failNext["spaces.createDoc"] = 1;
		}
	});
	await page.getByRole("button", { name: "Create first ticket" }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture failure: spaces.createDoc"
	);
	await page.getByRole("button", { name: "Create first ticket" }).click();
	await expect(
		page.getByRole("heading", { name: "New support question" })
	).toBeVisible();
	const successfulCreates = await fixtureCalls(page, "spaces.createDoc");
	expect(successfulCreates).toHaveLength(2);
	const successfulWrites = await fixtureCalls(page, "spaces.updateDoc");
	expect(successfulWrites).toHaveLength(1);
	expect(
		await savedDocument(page, "created-doc-1", ticketDocumentSchema)
	).toMatchObject({ subject: "New support question", status: "open" });
});

test("turns a ticket answer into a linked article and opens its related article", async ({
	page,
}) => {
	/*
	 * Create article draft persists its source ticket, tags, and conversation answer as a draft.
	 * Selecting a related article opens Knowledge with the persisted source article visible.
	 */
	await openApp(page, "tickets");
	await page
		.getByTestId("help-center-ticket-row")
		.filter({ hasText: "Cannot export a report" })
		.click();
	await page.evaluate(() => {
		if (window.__helpCenterTestHost) {
			window.__helpCenterTestHost.failNext["spaces.createDoc"] = 1;
		}
	});
	await page.getByRole("button", { name: "Create article draft" }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture failure: spaces.createDoc"
	);
	await page.getByRole("button", { name: "Create article draft" }).click();
	await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
	const draftArticle = page
		.locator("article")
		.filter({ hasText: "Cannot export a report" });
	await expect(draftArticle).toBeVisible();
	await expect(draftArticle).toContainText(
		"The report export spins and no file downloads."
	);
	const created = await fixtureCalls(page, "spaces.createDoc");
	expect(created).toHaveLength(2);
	expect(createDocumentInputSchema.parse(created[0]?.payload).title).toBe(
		"Cannot export a report"
	);
	const saved = await savedDocument(
		page,
		"created-doc-1",
		articleDocumentSchema
	);
	expect(saved).toMatchObject({
		sourceTicketIds: ["ticket-export"],
		tags: ["reports", "exports"],
		title: "Cannot export a report",
		status: "draft",
	});

	// Selecting a linked knowledge row routes to the Knowledge view and preserves its source article.
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
	await page
		.getByTestId("help-center-ticket-row")
		.filter({ hasText: "Cannot export a report" })
		.click();
	await page
		.getByRole("option", { name: /Exporting a report from Ryu/ })
		.click();
	await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
	await expect(
		page.getByText("Exporting a report from Ryu", { exact: true })
	).toBeVisible();
});
