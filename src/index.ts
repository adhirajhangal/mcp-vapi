#!/usr/bin/env node

// MCP server for Vapi, manage assistants, fire calls, pull transcripts.
// Set VAPI_API_KEY before running, dashboard.vapi.ai → Account → API Keys.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
	listAssistants,
	getAssistant,
	createAssistant,
	updateAssistant,
	deleteAssistant,
	createCall,
	listCalls,
	getCall,
	endCall,
	listPhoneNumbers,
	getPhoneNumber,
	listSquads,
	getSquad,
	createSquad,
	updateSquad,
	deleteSquad,
} from './vapi.js';

const server = new McpServer({
	name: 'mcp-vapi',
	version: '0.1.0',
});

// ─── Assistants ───────────────────────────────────────────────────────────────

server.registerTool(
	'vapi_list_assistants',
	{
		title: 'List Vapi Assistants',
		description: 'List all voice assistants in your Vapi account. Returns IDs, names, and config.',
		inputSchema: z.object({
			limit: z.number().optional().describe('Max number of assistants to return (default: 100)'),
			createdAtGt: z.string().optional().describe('Only return assistants created after this ISO date'),
			createdAtLt: z.string().optional().describe('Only return assistants created before this ISO date'),
		}),
	},
	async (args) => {
		const result = await listAssistants(args);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_get_assistant',
	{
		title: 'Get Vapi Assistant',
		description: 'Get full details of a specific Vapi assistant by ID, including its model, voice, and prompt config.',
		inputSchema: z.object({
			assistantId: z.string().describe('The ID of the assistant to retrieve'),
		}),
	},
	async ({ assistantId }) => {
		const result = await getAssistant(assistantId);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_create_assistant',
	{
		title: 'Create Vapi Assistant',
		description:
			'Create a new Vapi voice assistant. You can set its name, first message, system prompt, LLM model, voice, and more.',
		inputSchema: z.object({
			name: z.string().describe('A name for this assistant (for your reference)'),
			firstMessage: z
				.string()
				.optional()
				.describe("What the assistant says when it picks up — e.g. 'Hey, is this John?'"),
			systemPrompt: z
				.string()
				.optional()
				.describe('The main system prompt defining the assistant personality, goal, and knowledge'),
			modelProvider: z
				.enum(['openai', 'anthropic', 'groq', 'google', 'together-ai', 'custom-llm'])
				.optional()
				.describe('LLM provider (default: openai)'),
			modelName: z
				.string()
				.optional()
				.describe('Model name, e.g. gpt-4o-mini, gpt-4o, claude-3-5-sonnet-20241022'),
			voiceProvider: z
				.enum(['elevenlabs', 'cartesia', 'playht', 'deepgram', 'lmnt', 'azure', 'openai'])
				.optional()
				.describe('Text-to-speech provider'),
			voiceId: z.string().optional().describe('Voice ID from your TTS provider'),
			maxDurationSeconds: z
				.number()
				.optional()
				.describe('Max call length in seconds — prevents runaway billing (default: 300)'),
			serverUrl: z.string().optional().describe('Webhook URL to receive call events and transcripts'),
		}),
	},
	async (args) => {
		// Vapi wants model and voice as nested objects, build them here.
		const body: Record<string, unknown> = { name: args.name };

		if (args.firstMessage) body.firstMessage = args.firstMessage;
		if (args.maxDurationSeconds) body.maxDurationSeconds = args.maxDurationSeconds;
		if (args.serverUrl) body.serverUrl = args.serverUrl;

		if (args.systemPrompt || args.modelProvider || args.modelName) {
			body.model = {
				provider: args.modelProvider ?? 'openai',
				model: args.modelName ?? 'gpt-4o-mini',
				...(args.systemPrompt ? { systemPrompt: args.systemPrompt } : {}),
			};
		}

		if (args.voiceProvider || args.voiceId) {
			body.voice = {
				provider: args.voiceProvider ?? 'elevenlabs',
				...(args.voiceId ? { voiceId: args.voiceId } : {}),
			};
		}

		const result = await createAssistant(body);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_update_assistant',
	{
		title: 'Update Vapi Assistant',
		description: 'Update an existing assistant (partial update — only send the fields you want to change).',
		inputSchema: z.object({
			assistantId: z.string().describe('The ID of the assistant to update'),
			name: z.string().optional().describe('New name for the assistant'),
			firstMessage: z.string().optional().describe('New first message'),
			systemPrompt: z.string().optional().describe('New system prompt'),
			maxDurationSeconds: z.number().optional().describe('New max call duration in seconds'),
			serverUrl: z.string().optional().describe('New webhook URL'),
		}),
	},
	async ({ assistantId, ...fields }) => {
		const body: Record<string, unknown> = {};
		if (fields.name) body.name = fields.name;
		if (fields.firstMessage) body.firstMessage = fields.firstMessage;
		if (fields.systemPrompt) body.model = { systemPrompt: fields.systemPrompt };
		if (fields.maxDurationSeconds) body.maxDurationSeconds = fields.maxDurationSeconds;
		if (fields.serverUrl) body.serverUrl = fields.serverUrl;

		const result = await updateAssistant(assistantId, body);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_delete_assistant',
	{
		title: 'Delete Vapi Assistant',
		description: 'Permanently delete a Vapi assistant. This cannot be undone.',
		inputSchema: z.object({
			assistantId: z.string().describe('The ID of the assistant to delete'),
		}),
	},
	async ({ assistantId }) => {
		await deleteAssistant(assistantId);
		return { content: [{ type: 'text', text: `Assistant ${assistantId} deleted successfully.` }] };
	},
);

// ─── Calls ────────────────────────────────────────────────────────────────────

server.registerTool(
	'vapi_create_call',
	{
		title: 'Create Outbound Call',
		description:
			'Fire an outbound call using a Vapi assistant. Needs your Vapi phone number ID and the customer\'s number in E.164 format (+14155550100).',
		inputSchema: z.object({
			phoneNumberId: z
				.string()
				.describe('Your Vapi phone number ID — find it at dashboard.vapi.ai → Phone Numbers'),
			customerNumber: z
				.string()
				.describe('The number to call in E.164 format (e.g. +14155550100)'),
			customerName: z.string().optional().describe('Name of the person being called (assistants can use this)'),
			assistantId: z.string().optional().describe('ID of a saved assistant to use for this call'),
			metadata: z
				.record(z.unknown())
				.optional()
				.describe(
					'Custom data attached to this call — returned on webhooks, great for linking to CRM records',
				),
			serverUrl: z.string().optional().describe('Webhook URL to receive events for this call'),
			maxDurationSeconds: z.number().optional().describe('Max call length in seconds'),
			assistantOverrides: z
				.record(z.unknown())
				.optional()
				.describe('Override assistant settings for this call only (e.g. firstMessage, variableValues)'),
		}),
	},
	async (args) => {
		const result = await createCall({
			phoneNumberId: args.phoneNumberId,
			customerNumber: args.customerNumber,
			customerName: args.customerName,
			assistantId: args.assistantId,
			metadata: args.metadata as Record<string, unknown> | undefined,
			serverUrl: args.serverUrl,
			maxDurationSeconds: args.maxDurationSeconds,
			assistantOverrides: args.assistantOverrides as Record<string, unknown> | undefined,
		});
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_list_calls',
	{
		title: 'List Vapi Calls',
		description: 'List calls with optional filters. Returns call IDs, status, cost, and basic info.',
		inputSchema: z.object({
			limit: z.number().optional().describe('Max number of calls to return (default: 100)'),
			assistantId: z.string().optional().describe('Filter to calls using a specific assistant'),
			phoneNumberId: z.string().optional().describe('Filter to calls from a specific phone number'),
			createdAtGt: z.string().optional().describe('Only return calls created after this ISO date'),
			createdAtLt: z.string().optional().describe('Only return calls created before this ISO date'),
		}),
	},
	async (args) => {
		const result = await listCalls(args);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_get_call',
	{
		title: 'Get Vapi Call',
		description:
			'Get full details of a call including transcript, recording URL, cost, end reason, and summary.',
		inputSchema: z.object({
			callId: z.string().describe('The ID of the call to retrieve'),
		}),
	},
	async ({ callId }) => {
		const result = await getCall(callId);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_end_call',
	{
		title: 'End Active Call',
		description: 'Force-end an active Vapi call. Useful if a call gets stuck or needs to be terminated from a workflow.',
		inputSchema: z.object({
			callId: z.string().describe('The ID of the active call to end'),
		}),
	},
	async ({ callId }) => {
		await endCall(callId);
		return { content: [{ type: 'text', text: `Call ${callId} ended successfully.` }] };
	},
);

// ─── Phone Numbers ────────────────────────────────────────────────────────────

server.registerTool(
	'vapi_list_phone_numbers',
	{
		title: 'List Vapi Phone Numbers',
		description: 'List all phone numbers in your Vapi account. Use the IDs when creating calls.',
		inputSchema: z.object({
			limit: z.number().optional().describe('Max number of phone numbers to return'),
		}),
	},
	async (args) => {
		const result = await listPhoneNumbers(args);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_get_phone_number',
	{
		title: 'Get Vapi Phone Number',
		description: 'Get details of a specific Vapi phone number.',
		inputSchema: z.object({
			phoneNumberId: z.string().describe('The ID of the phone number'),
		}),
	},
	async ({ phoneNumberId }) => {
		const result = await getPhoneNumber(phoneNumberId);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

// ─── Squads ───────────────────────────────────────────────────────────────────

server.registerTool(
	'vapi_list_squads',
	{
		title: 'List Vapi Squads',
		description: 'List all squads in your account. Squads are groups of assistants that hand off to each other.',
		inputSchema: z.object({
			limit: z.number().optional().describe('Max number of squads to return'),
		}),
	},
	async (args) => {
		const result = await listSquads(args);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_get_squad',
	{
		title: 'Get Vapi Squad',
		description: 'Get details of a specific squad including its member assistants.',
		inputSchema: z.object({
			squadId: z.string().describe('The ID of the squad'),
		}),
	},
	async ({ squadId }) => {
		const result = await getSquad(squadId);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_create_squad',
	{
		title: 'Create Vapi Squad',
		description:
			'Create a squad of assistants that can hand off to each other on a call. Great for receptionist → qualifier → closer flows.',
		inputSchema: z.object({
			name: z.string().describe('Name for this squad'),
			members: z
				.array(z.record(z.unknown()))
				.describe(
					'Array of squad members. Each needs at least an "assistantId". Example: [{"assistantId":"xxx"},{"assistantId":"yyy"}]',
				),
		}),
	},
	async ({ name, members }) => {
		const result = await createSquad({ name, members });
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_update_squad',
	{
		title: 'Update Vapi Squad',
		description: 'Update a squad — rename it or change its members.',
		inputSchema: z.object({
			squadId: z.string().describe('The ID of the squad to update'),
			name: z.string().optional().describe('New name for the squad'),
			members: z.array(z.record(z.unknown())).optional().describe('Updated array of squad members'),
		}),
	},
	async ({ squadId, ...fields }) => {
		const result = await updateSquad(squadId, fields as Record<string, unknown>);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	},
);

server.registerTool(
	'vapi_delete_squad',
	{
		title: 'Delete Vapi Squad',
		description: 'Permanently delete a squad.',
		inputSchema: z.object({
			squadId: z.string().describe('The ID of the squad to delete'),
		}),
	},
	async ({ squadId }) => {
		await deleteSquad(squadId);
		return { content: [{ type: 'text', text: `Squad ${squadId} deleted successfully.` }] };
	},
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
