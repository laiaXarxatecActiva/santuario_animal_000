import { describe, expect, it } from 'vitest';
import { USER_TOKEN_TYPES } from '../src/constants/auth.js';

describe('constantes de autenticación', () => {
  it('los tipos de token coinciden con el CHECK de user_tokens.type', () => {
    expect(USER_TOKEN_TYPES).toEqual(['email_verification', 'password_reset']);
  });
});
