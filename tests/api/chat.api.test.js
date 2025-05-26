import request from "supertest";
import express from "express";
import chatRoutes from "../../routes/chat.routes.js";

const app = express();
app.use(express.json());
app.use("/api", chatRoutes);

jest.mock("ollama", () => ({
  chat: jest
    .fn()
    .mockResolvedValue({ message: { content: "mocked response" } }),
}));

describe("POST /api/chat", () => {
  it("should return 200 and the LLM response for valid input", async () => {
    const res = await request(app).post("/api/chat").send({ query: "Hello" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("response", "mocked response");
  });

  it("should return 400 for invalid input", async () => {
    const res = await request(app).post("/api/chat").send({ query: "" });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty(
      "message",
      "Query must be at least 2 characters long"
    );
  });
});
