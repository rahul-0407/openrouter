import { Elysia, t } from "elysia";
import bearer from "@elysiajs/bearer"
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";

const app = new Elysia()
.use(bearer())
.post("/api/v1/chat/completions", async ({bearer, body}) => {

  const model = body.model;
  const providerModelName = model.split("/")[1];
  const response = await Gemini.chat(providerModelName, body.messages)
  return response;

},{
  body: Conversation
}).listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
