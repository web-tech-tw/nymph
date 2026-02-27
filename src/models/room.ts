import { useDatabase } from "../clients/database.ts";
import schemaRoom from "../schemas/room.ts";

const database = useDatabase();

export default database.model("Room", schemaRoom);
