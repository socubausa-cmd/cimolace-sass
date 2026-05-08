"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("./auth/auth.module");
const tenant_module_1 = require("./tenant/tenant.module");
const med_ehr_module_1 = require("./med-ehr/med-ehr.module");
const med_notes_module_1 = require("./med-notes/med-notes.module");
const med_forms_module_1 = require("./med-forms/med-forms.module");
const med_health_module_1 = require("./med-health/med-health.module");
const med_programs_module_1 = require("./med-programs/med-programs.module");
const med_prescriptions_module_1 = require("./med-prescriptions/med-prescriptions.module");
const med_charting_module_1 = require("./med-charting/med-charting.module");
const med_gdpr_module_1 = require("./med-gdpr/med-gdpr.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_module_1.TenantModule,
            med_ehr_module_1.MedEhrModule,
            med_notes_module_1.MedNotesModule,
            med_forms_module_1.MedFormsModule,
            med_health_module_1.MedHealthModule,
            med_programs_module_1.MedProgramsModule,
            med_prescriptions_module_1.MedPrescriptionsModule,
            med_charting_module_1.MedChartingModule,
            med_gdpr_module_1.MedGdprModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map