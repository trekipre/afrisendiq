import axios from "axios";

export async function GET() {

  const res = await axios.get(
    "https://open.er-api.com/v6/latest/USD"
  );

  return Response.json(res.data);
}