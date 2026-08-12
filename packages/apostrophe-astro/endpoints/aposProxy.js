import aposResponse from "../lib/aposResponse.js";

export async function ALL({ request }) {
  try {
    // Prevent certain values of Connection, such as Upgrade, from causing an undici error in Node.js fetch
    request.headers.delete('Connection');
    return await aposResponse(request);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};
