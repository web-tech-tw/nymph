// This function is called when a new event is added to the timeline of a room.

export default async (roomId: string, event: any, error: Error) => {
    console.error(
        `Failed to decrypt ${roomId} ${event["event_id"]} because `,
        error,
    );
};
