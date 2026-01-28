export function validatePhone(phone: string): boolean {
    // Basic regex for international numbers or local numbers
    // Allows +, spaces, dashes, parentheses
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    // Or simpler one: at least 7 digits
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function sanitizeQuery(query: string): string {
    return query.trim().toLowerCase();
}
