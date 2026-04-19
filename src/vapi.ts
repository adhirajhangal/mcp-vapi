// Vapi API client, all the fetch calls live here and none in the tools.
// Base url: https://api.vapi.ai, auth is a Bearer token.

const BASE_URL = 'https://api.vapi.ai';

// Read from env, set VAPI_API_KEY before you run this.
function getApiKey(): string {
	const key = process.env.VAPI_API_KEY;
	if (!key) {
		throw new Error(
			'VAPI_API_KEY environment variable is not set. ' +
			'Get your key at dashboard.vapi.ai → Account → API Keys',
		);
	}
	return key;
}

// Every request goes through here.
async function vapiRequest<T>(
	method: string,
	path: string,
	body?: Record<string, unknown>,
	query?: Record<string, string | number | undefined>,
): Promise<T> {
	const url = new URL(`${BASE_URL}${path}`);

	// Filters go in query params, not the body.
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined && value !== '') {
				url.searchParams.set(key, String(value));
			}
		}
	}

	const response = await fetch(url.toString(), {
		method,
		headers: {
			Authorization: `Bearer ${getApiKey()}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	// Vapi's error messages are useful, surface them directly.
	if (!response.ok) {
		const errorText = await response.text();
		let errorMessage: string;
		try {
			const errorJson = JSON.parse(errorText) as { message?: string };
			errorMessage = errorJson.message ?? errorText;
		} catch {
			errorMessage = errorText;
		}
		throw new Error(`Vapi API error ${response.status}: ${errorMessage}`);
	}

	// Delete returns 204 with no body.
	if (response.status === 204) {
		return {} as T;
	}

	return response.json() as Promise<T>;
}

// ─── Assistants ───────────────────────────────────────────────────────────────

export interface VapiListParams {
	limit?: number;
	createdAtGt?: string;
	createdAtLt?: string;
	updatedAtGt?: string;
	updatedAtLt?: string;
}

export function listAssistants(params?: VapiListParams) {
	return vapiRequest<unknown[]>('GET', '/assistant', undefined, params as Record<string, string | number | undefined>);
}

export function getAssistant(assistantId: string) {
	return vapiRequest<unknown>('GET', `/assistant/${assistantId}`);
}

export function createAssistant(data: Record<string, unknown>) {
	return vapiRequest<unknown>('POST', '/assistant', data);
}

export function updateAssistant(assistantId: string, data: Record<string, unknown>) {
	// Partial update, only send what you're changing.
	return vapiRequest<unknown>('PATCH', `/assistant/${assistantId}`, data);
}

export function deleteAssistant(assistantId: string) {
	return vapiRequest<unknown>('DELETE', `/assistant/${assistantId}`);
}

// ─── Calls ────────────────────────────────────────────────────────────────────

export interface CreateCallParams {
	phoneNumberId: string;
	customerNumber: string;
	customerName?: string;
	assistantId?: string;
	// For one-off configs, not saved to your account.
	assistant?: Record<string, unknown>;
	// Override per call without touching the saved assistant.
	assistantOverrides?: Record<string, unknown>;
	// Comes back on every webhook event, link it to whatever triggered the call.
	metadata?: Record<string, unknown>;
	serverUrl?: string;
	maxDurationSeconds?: number;
}

export function createCall(params: CreateCallParams) {
	const body: Record<string, unknown> = {
		phoneNumberId: params.phoneNumberId,
		customer: {
			number: params.customerNumber,
			...(params.customerName ? { name: params.customerName } : {}),
		},
	};

	if (params.assistantId) body.assistantId = params.assistantId;
	if (params.assistant) body.assistant = params.assistant;
	if (params.assistantOverrides) body.assistantOverrides = params.assistantOverrides;
	if (params.metadata) body.metadata = params.metadata;
	if (params.serverUrl) body.serverUrl = params.serverUrl;
	if (params.maxDurationSeconds) body.maxDurationSeconds = params.maxDurationSeconds;

	return vapiRequest<unknown>('POST', '/call', body);
}

export interface ListCallsParams {
	limit?: number;
	assistantId?: string;
	phoneNumberId?: string;
	createdAtGt?: string;
	createdAtLt?: string;
}

export function listCalls(params?: ListCallsParams) {
	return vapiRequest<unknown[]>('GET', '/call', undefined, params as Record<string, string | number | undefined>);
}

export function getCall(callId: string) {
	// Includes transcript, recordingUrl, cost, and endedReason.
	return vapiRequest<unknown>('GET', `/call/${callId}`);
}

export function endCall(callId: string) {
	return vapiRequest<unknown>('DELETE', `/call/${callId}`);
}

// ─── Phone Numbers ────────────────────────────────────────────────────────────

export function listPhoneNumbers(params?: { limit?: number; createdAtGt?: string }) {
	return vapiRequest<unknown[]>('GET', '/phone-number', undefined, params as Record<string, string | number | undefined>);
}

export function getPhoneNumber(phoneNumberId: string) {
	return vapiRequest<unknown>('GET', `/phone-number/${phoneNumberId}`);
}

// ─── Squads ───────────────────────────────────────────────────────────────────

// Multiple assistants that hand off to each other on one call, receptionist to qualifier to closer, that kind of thing.

export function listSquads(params?: { limit?: number }) {
	return vapiRequest<unknown[]>('GET', '/squad', undefined, params as Record<string, string | number | undefined>);
}

export function getSquad(squadId: string) {
	return vapiRequest<unknown>('GET', `/squad/${squadId}`);
}

export function createSquad(data: { name: string; members: unknown[] }) {
	return vapiRequest<unknown>('POST', '/squad', data as Record<string, unknown>);
}

export function updateSquad(squadId: string, data: Record<string, unknown>) {
	return vapiRequest<unknown>('PATCH', `/squad/${squadId}`, data);
}

export function deleteSquad(squadId: string) {
	return vapiRequest<unknown>('DELETE', `/squad/${squadId}`);
}
