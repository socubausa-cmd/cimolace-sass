/**
 * Tests unitaires — MboloService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MboloService } from './mbolo.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildChain(
  singleResult = { data: null as unknown, error: null as unknown },
) {
  const chain: Record<string, jest.Mock> = {};
  [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'in',
    'limit',
    'order',
  ].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb({ data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const TENANT_ID = 'tenant-0001';
const USER_ID = 'user-0001';
const FAKE_PRODUCT = {
  id: 'prod-001',
  name: 'Livre',
  price_cents: 2500,
  is_active: true,
  tenant_id: TENANT_ID,
};
const FAKE_CART_ITEM = {
  id: 'cart-001',
  product_id: 'prod-001',
  quantity: 1,
  product: FAKE_PRODUCT,
};

describe('MboloService', () => {
  let service: MboloService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MboloService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<MboloService>(MboloService);
  });

  it('1. createProduct → retourne produit', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_PRODUCT, error: null }),
    );
    const result = await service.createProduct(TENANT_ID, {
      name: 'Livre',
      priceCents: 2500,
    });
    expect(result).toMatchObject({ id: 'prod-001' });
  });

  it('2. listProducts → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [FAKE_PRODUCT], error: null }),
    );
    const result = await service.listProducts(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('3. getProduct → trouvé → retourne produit', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: FAKE_PRODUCT, error: null }),
    );
    const result = await service.getProduct(TENANT_ID, 'prod-001');
    expect(result).toMatchObject({ id: 'prod-001' });
  });

  it('4. getProduct → introuvable → NotFoundException', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    await expect(service.getProduct(TENANT_ID, 'prod-xxx')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('5. addToCart → retourne panier mis à jour', async () => {
    // upsert cart item
    mockSupabase.client.from
      .mockReturnValueOnce(buildChain({ data: null, error: null })) // upsert
      // getCart → .then chain
      .mockReturnValueOnce(buildChain({ data: [FAKE_CART_ITEM], error: null }));

    const result = await service.addToCart(TENANT_ID, USER_ID, 'prod-001', 1);
    expect(Array.isArray(result)).toBe(true);
  });

  it('6. createOrder → panier vide → NotFoundException', async () => {
    // getCart returns empty
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    await expect(service.createOrder(TENANT_ID, USER_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('7. listOrders → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listOrders(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});
