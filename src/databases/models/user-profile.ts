import mongoose, { Schema, type Document } from "mongoose";

export interface IUserProfile {
    nickname: string;
    email: string;
    avatar_hash: string;
}

export interface IUserProfileDocument extends Document {
    _id: string; // userId
    profile: IUserProfile;
    updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfileDocument>(
    {
        _id: { type: String, required: true },
        profile: {
            nickname: { type: String, required: true },
            email: { type: String, required: true },
            avatar_hash: { type: String, required: true },
        },
    },
    {
        timestamps: true,
        collection: "user_profiles",
    },
);

export const UserProfileModel: mongoose.Model<IUserProfileDocument> =
    (mongoose.models.UserProfile as mongoose.Model<IUserProfileDocument>) ||
    mongoose.model<IUserProfileDocument>("UserProfile", UserProfileSchema);

const inMemoryProfileCache = new Map<string, IUserProfile>();

function isDbReady(): boolean {
    return mongoose.connection.readyState === 1;
}

export async function cacheUserProfile(
    userId: string,
    profile?: Partial<IUserProfile> | Record<string, unknown>,
): Promise<void> {
    if (!userId || !profile) return;

    const nickname = typeof profile.nickname === "string" ? profile.nickname.trim() : "";
    const email = typeof profile.email === "string" ? profile.email.trim() : "";
    const avatar_hash = typeof profile.avatar_hash === "string" ? profile.avatar_hash.trim() : "";

    if (!nickname || !email || !avatar_hash) return;

    const userProfile: IUserProfile = {
        nickname,
        email,
        avatar_hash,
    };

    inMemoryProfileCache.set(userId, userProfile);

    if (isDbReady()) {
        await UserProfileModel.findByIdAndUpdate(
            userId,
            { profile: userProfile },
            { upsert: true, new: true },
        ).exec();
    }
}

export async function getUserProfile(userId: string): Promise<IUserProfile | null> {
    if (!userId) return null;

    const cached = inMemoryProfileCache.get(userId);
    if (cached) return cached;

    if (isDbReady()) {
        const doc = await UserProfileModel.findById(userId).lean().exec();
        if (doc?.profile) {
            inMemoryProfileCache.set(userId, doc.profile);
            return doc.profile;
        }
    }

    return null;
}
