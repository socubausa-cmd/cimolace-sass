import { capMedosRole } from './auth.service';

/**
 * SÉCURITÉ (pont /auth/tenant-token) : preuve que le rôle demandé par le porteur d'une clé
 * tenant ne peut jamais dépasser le rôle RÉEL de l'utilisateur (anti-forge d'un token owner).
 */
describe('capMedosRole — plafond de rôle du pont tenant-token', () => {
  it('BLOQUE la forge : patient ne peut pas devenir owner/admin/practitioner', () => {
    expect(capMedosRole('patient', 'owner')).toBe('patient');
    expect(capMedosRole('patient', 'admin')).toBe('patient');
    expect(capMedosRole('patient', 'practitioner')).toBe('patient');
    expect(capMedosRole('patient', 'receptionist')).toBe('patient');
  });

  it('BLOQUE la forge : sans membership prouvé → plancher patient', () => {
    expect(capMedosRole(null, 'owner')).toBe('patient');
    expect(capMedosRole(null, 'admin')).toBe('patient');
    expect(capMedosRole(null, 'patient')).toBe('patient');
  });

  it('BLOQUE l’escalade partielle : receptionist ne peut pas devenir admin/owner', () => {
    expect(capMedosRole('receptionist', 'owner')).toBe('receptionist');
    expect(capMedosRole('receptionist', 'admin')).toBe('receptionist');
  });

  it('AUTORISE une demande légitime : rôle exact conservé si ≤ réel', () => {
    expect(capMedosRole('owner', 'owner')).toBe('owner');
    expect(capMedosRole('owner', 'practitioner')).toBe('practitioner'); // owner peut agir en rôle inférieur
    expect(capMedosRole('admin', 'admin')).toBe('admin');
    expect(capMedosRole('practitioner', 'practitioner')).toBe('practitioner');
    expect(capMedosRole('practitioner', 'patient')).toBe('patient');
  });

  it('RÉTROGRADE au rôle réel (vocabulaire MedOS) quand la demande dépasse', () => {
    expect(capMedosRole('clinic_admin', 'owner')).toBe('admin'); // clinic_admin → admin
    expect(capMedosRole('teacher', 'owner')).toBe('practitioner'); // teacher → practitioner
    expect(capMedosRole('secretariat', 'owner')).toBe('receptionist');
  });
});
