import { Schema, model } from "mongoose";

export interface IMatrixAccess {
    username: string;
    accessToken: string;
}

const schema = new Schema<IMatrixAccess>({
    username: { type: String, required: true },
    accessToken: { type: String, required: true },
});

export const MatrixAccess = model<IMatrixAccess>("MatrixAccess", schema);
