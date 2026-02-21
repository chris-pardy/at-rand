import { AtpAgent } from "@atproto/api";

export interface PdsConfig {
  service: string;
  identifier: string;
  password: string;
}

export async function createAgent(config: PdsConfig): Promise<AtpAgent> {
  const agent = new AtpAgent({ service: config.service });
  await agent.login({
    identifier: config.identifier,
    password: config.password,
  });
  return agent;
}

export async function getRecord(
  agent: AtpAgent,
  repo: string,
  collection: string,
  rkey: string
): Promise<{ uri: string; cid: string; value: Record<string, unknown> } | null> {
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo,
      collection,
      rkey,
    });
    return {
      uri: res.data.uri,
      cid: res.data.cid!,
      value: res.data.value as Record<string, unknown>,
    };
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error.status === 404 || error.status === 400) {
      return null;
    }
    throw err;
  }
}

export async function putRecord(
  agent: AtpAgent,
  collection: string,
  rkey: string,
  record: Record<string, unknown>
): Promise<{ uri: string; cid: string }> {
  const res = await agent.com.atproto.repo.putRecord({
    repo: agent.session!.did,
    collection,
    rkey,
    record,
  });
  return { uri: res.data.uri, cid: res.data.cid };
}
