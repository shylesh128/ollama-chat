import { invokeLLM } from "../../services/chat.service.js";

jest.mock("ollama", () => ({
  chat: jest
    .fn()
    .mockResolvedValue({ message: { content: "mocked response" } }),
}));

describe("invokeLLM", () => {
  it("should return the LLM response content", async () => {
    const result = await invokeLLM("test query");
    expect(result).toBe("mocked response");
  });

  it("should throw an error if ollama.chat fails", async () => {
    const ollama = require("ollama");
    ollama.chat.mockRejectedValueOnce(new Error("fail"));
    await expect(invokeLLM("test query")).rejects.toThrow(
      "Failed to invoke LLM: fail"
    );
  });
});
