import { Schema } from "mongoose";

export default new Schema({
    username: {
        type: String,
        required: true,
    },
    accessToken: {
        type: String,
        required: true,
    },
});
