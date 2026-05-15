// Validation utilities with real-time feedback

export interface EmailValidation {
  valid: boolean;
  error: string | null;
}

export interface PasswordValidation {
  valid: boolean;
  minLength: boolean;      // >= 6 chars
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

export function validateEmail(email: string): EmailValidation {
  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false, error: 'Email is required' };
  }

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, error: null };
}

export function validatePassword(password: string): PasswordValidation {
  return {
    valid: password.length >= 6 && /[A-Z]/.test(password) && /[a-z]/.test(password),
    minLength: password.length >= 6,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

export function getPasswordStrength(pwd: PasswordValidation): {
  score: number;      // 0-4
  label: string;
  color: string;
} {
  let score = 0;
  if (pwd.minLength) score++;
  if (pwd.hasUppercase) score++;
  if (pwd.hasLowercase) score++;
  if (pwd.hasNumber) score++;

  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const colors = ['#C8343A', '#B87C3A', '#A89060', '#6B9E6B', '#4CAF50'];

  return {
    score: Math.min(score, 4),
    label: labels[score] || 'Weak',
    color: colors[score] || colors[0],
  };
}
