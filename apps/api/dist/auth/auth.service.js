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
const CIMOLACE_STAFF_ROLES = new Set(['owner', 'admin', 'support']);
let AuthService = class AuthService {
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } });
        this.jwtSecret = process.env.MEDOS_JWT_SECRET ?? '';
        if (!this.jwtSecret) {
            console.warn('[MedOS] MEDOS_JWT_SECRET non défini — le pont tenant-token ne fonctionnera pas');
        }
        this.cimolaceAdminEmails = new Set(String(process.env.CIMOLACE_BACKOFFICE_ADMIN_EMAILS ?? '')
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean));
    }
    async verifyToken(token) {
        const { data, error } = await this.supabase.auth.getUser(token);
        if (error || !data.user)
            return null;
        return {
            id: data.user.id,
            email: data.user.email ?? '',
            role: 'authenticated',
            user_metadata: (data.user.user_metadata ?? {}),
            app_metadata: (data.user.app_metadata ?? {}),
        };
    }
    async resolveCimolaceIdentity(user) {
        const userId = user.id;
        const email = String(user.email ?? '').toLowerCase();
        const userMeta = (user.user_metadata ?? {});
        const appMeta = (user.app_metadata ?? {});
        let cimolaceStaff = userMeta.cimolace_staff === true || appMeta.cimolace_staff === true;
        let staffRole = null;
        let profileMetadata = {};
        if (email && this.cimolaceAdminEmails.has(email)) {
            cimolaceStaff = true;
        }
        try {
            const { data: staff } = await this.supabase
                .from('cimolace_staff_members')
                .select('role,status')
                .eq('user_id', userId)
                .eq('status', 'active')
                .maybeSingle();
            const role = String(staff?.role ?? '').toLowerCase();
            if (role && CIMOLACE_STAFF_ROLES.has(role)) {
                cimolaceStaff = true;
                staffRole = role;
            }
        }
        catch {
        }
        try {
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('metadata,status')
                .eq('id', userId)
                .maybeSingle();
            if (profile) {
                profileMetadata = profile.metadata ?? {};
                if (profile.status === 'active' && profileMetadata.cimolace_staff === true) {
                    cimolaceStaff = true;
                }
            }
        }
        catch {
        }
        const role = staffRole ||
            (cimolaceStaff ? 'owner' : String(user.role ?? 'authenticated').toLowerCase());
        return {
            id: userId,
            email: user.email ?? '',
            role,
            cimolace_staff: cimolaceStaff,
            metadata: { ...profileMetadata, cimolace_staff: cimolaceStaff },
        };
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