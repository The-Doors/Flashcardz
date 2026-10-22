import {
	userShow,
} from "./generated/api-generated.ts";

export async function readCurrentUser(accessToken: string) {
	const response = await userShow({
		headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
	});
	if (Number(response.status) === 404 || Number(response.status) === 401)
		return null;
	if (response.status !== 200) throw new Error("Could not check your profile.");
	return response.data;
}

export async function createUser(accessToken: string, payload: UserCreate) {
	// const response = await createUserUsersPost(payload, {
	// 	headers: { Authorization: `Bearer ${accessToken}` },
	// });
	// if (Number(response.status) === 409)
	// 	throw new Error("That username is already taken.");
	// if (response.status !== 201)
	// 	throw new Error("Could not create your profile. Please retry.");
	// return response.data;
	throw new Error("this is temporarily disabled. it'll be fixed later")
}
