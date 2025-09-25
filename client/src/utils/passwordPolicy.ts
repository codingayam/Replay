export interface PasswordRuleResult {
  id: string;
  label: string;
  met: boolean;
}

interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 10 characters',
    test: (password) => password.length >= 10,
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least one number',
    test: (password) => /\d/.test(password),
  },
  {
    id: 'symbol',
    label: 'At least one special character',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export const getPasswordRuleResults = (password: string): PasswordRuleResult[] =>
  PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));

export const validatePasswordStrength = (password: string) => {
  const details = getPasswordRuleResults(password);
  const failedRules = details.filter((rule) => !rule.met);

  return {
    isValid: failedRules.length === 0,
    details,
    failedRuleLabels: failedRules.map((rule) => rule.label),
  };
};

export const PASSWORD_REQUIREMENT_SUMMARY =
  'Password must be at least 10 characters and include upper and lower case letters, a number, and a special character.';
