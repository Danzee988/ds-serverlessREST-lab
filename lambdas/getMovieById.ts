import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";

// Create DynamoDB Document Client
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));

    const parameters = event?.pathParameters;
    const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;

    const queryParams = event?.queryStringParameters;
    const includeCast = queryParams?.cast === "true";

    if (!movieId) {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing movie Id" }),
      };
    }

    // Fetch movie metadata from Movies table
    const movieCommandOutput = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME, // Movies table name
        Key: { id: movieId }, // 'id' should be your primary key in the Movies table
      })
    );

    if (!movieCommandOutput.Item) {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Invalid movie Id" }),
      };
    }

    const responseBody: any = { data: movieCommandOutput.Item };

    // If ?cast=true, fetch cast information from the MovieCast table
    if (includeCast) {
      const castCommandInput: QueryCommandInput = {
        TableName: process.env.CAST_TABLE_NAME, // MovieCast table name
        KeyConditionExpression: "movieId = :m",  // Query by movieId
        ExpressionAttributeValues: {
          ":m": movieId,
        },
      };

      // Fetch cast information from the MovieCast table
      const castCommandOutput = await ddbDocClient.send(new QueryCommand(castCommandInput));

      // Add cast information to the response
      responseBody.cast = castCommandOutput.Items || [];
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(responseBody),
    };

  } catch (error: any) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Helper function to create DynamoDB Document Client
function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = { wrapNumbers: false };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
