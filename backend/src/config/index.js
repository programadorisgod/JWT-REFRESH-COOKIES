export const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
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

const isProduction = process.env.NODE_ENV === 'production';

export const cookieConfig = {
    refreshToken: {
        name: "refreshToken",
        httpOnly: true,
        secure: isProduction, // Solo en producción (requires HTTPS)
        sameSite: "strict",
        path: "/api/auth/refresh", // Scope específico para minimizar superficie
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en ms
    },
    csrfToken: {
        name: "csrf_token",
        httpOnly: false, // Debe ser accesible desde JS
        secure: isProduction, // Solo en producción (requires HTTPS)
        sameSite: "strict",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000, // 1 día
    },
};
