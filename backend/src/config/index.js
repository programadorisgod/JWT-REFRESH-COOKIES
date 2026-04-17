export const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: true,
    },
};

export const jwtConfig = {
    accessSecret:
        process.env.JWT_ACCESS_SECRET || "access-secret-change-in-production",
    refreshSecret:
        process.env.JWT_REFRESH_SECRET || "refresh-secret-change-in-production",
    accessExpiresIn: "5m", // 5 minutos - corto para seguridad
    refreshExpiresIn: "7d", // 7 días
    csrfExpiresIn: "1d", // 1 día
    slidingRefresh: true,  // Extender expiración en cada uso
    absoluteMaxAge: "30d", // Límite absoluto máximo
    maxSessionsPerUser: 5, // Límite de sesiones activas
};

export const cookieConfig = {
    refreshToken: {
        name: "refreshToken",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en ms
    },
    csrfToken: {
        name: "csrf_token",
        httpOnly: false, // Debe ser accesible desde JS
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000, // 1 día
    },
};
