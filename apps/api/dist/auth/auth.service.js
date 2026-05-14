"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const supabase_js_1 = require("@supabase/supabase-js");
const crypto_1 = require("crypto");
const jwt = require('jsonwebtoken');
let AuthService = class AuthService {
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } });
        this.jwtSecret = process.env.MEDOS_JWT_SECRET ?? '';
        if (!this.jwtSecret) {
            console.warn('[MedOS] MEDOS_JWT_SECRET non défini — le pont tenant-token ne fonctionnera pas');
        }
    }
    async verifyToken(token) {
        const { data, error } = await this.supabase.auth.getUser(token);
        if (error || !data.user)
            return null;
        return { id: data.user.id, email: data.user.email ?? '', role: 'authenticated' };
    }
    generateMedosToken(payload) {
        if (!this.jwtSecret)
            throw new Error('MEDOS_JWT_SECRET manquant');
        return jwt.sign({ ...payload, iss: 'medos' }, this.jwtSecret, {
            expiresIn: '15m',
            algorithm: 'HS256',
        });
    }
    verifyMedosToken(token) {
        if (!this.jwtSecret)
            return null;
        try {
            const payload = jwt.verify(token, this.jwtSecret, {
                algorithms: ['HS256'],
                issuer: 'medos',
            });
            return payload;
        }
        catch {
            return null;
        }
    }
    safeCompare(a, b) {
        try {
            return (0, crypto_1.timingSafeEqual)(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
        }
        catch {
            return false;
        }
    }
    getClient() {
        return this.supabase;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AuthService);
//# sourceMappingURL=auth.service.js.map