import { SquareClient, SquareEnvironment, SquareError } from "square"

export async function GET() {
  try {
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return Response.json(
        {
          success: false,
          error: "SQUARE_ACCESS_TOKEN is missing.",
        },
        { status: 500 }
      )
    }

    const client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment: SquareEnvironment.Sandbox,
    })

    const response = await client.locations.list()

    return Response.json({
      success: true,
      message: "Square Sandbox connection is working.",
      locationCount: response.locations?.length ?? 0,
    })
  } catch (error) {
    if (error instanceof SquareError) {
      console.error("Square connection error:", error)

      return Response.json(
        {
          success: false,
          error: error.message,
          squareErrors: error.errors,
        },
        { status: 500 }
      )
    }

    console.error("Unexpected Square connection error:", error)

    return Response.json(
      {
        success: false,
        error: "Unexpected Square connection error.",
      },
      { status: 500 }
    )
  }
}