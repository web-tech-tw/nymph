import { useDatabase } from "../clients/database.ts";
import schemaMatrixData from "../schemas/matrix_access.ts";

const database = useDatabase();

export default database.model("MatrixAccess", schemaMatrixData);
