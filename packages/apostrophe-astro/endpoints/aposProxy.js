import aposResponse from "../lib/aposResponse.js";

export async function ALL({ request }) {
  try {
    return await aposResponse(request);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};
