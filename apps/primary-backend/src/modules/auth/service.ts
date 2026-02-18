

export abstract class AuthService {
    static async signup (email: string, password: string):Promise<string> {
        return "123";
    }

    static async signin (email: string, password: string):Promise<string> {
        return "token";
    }
}