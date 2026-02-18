import {Elysia} from "elysia";

export const app = new Elysia({prefix: "/auth"})
  .post("/sign-up", ({body}) => {
    
  },{
    
  })
  .post("/sign-in", () => {
    return {
      message: "Login successful",
    };
  });