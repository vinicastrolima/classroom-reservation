import { afterEach, describe, expect, it, vi } from "vitest";

import { recommendationApi } from "../api";

describe("recommendationApi.find", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia os critérios ao endpoint stateless", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ recommendations: [], message: "Nenhuma configuração atende às restrições informadas." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await recommendationApi.find({
      start_time: "2026-10-01T10:00:00.000Z",
      end_time: "2026-10-01T12:00:00.000Z",
      participant_count: 25,
      strategy: "WEIGHTED_SCORE",
    });

    expect(response.recommendations).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/recomendacoes/ambientes");
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toMatchObject({ participant_count: 25 });
  });
});
