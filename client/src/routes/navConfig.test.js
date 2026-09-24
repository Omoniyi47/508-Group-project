import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from './navConfig';

describe('dashboard navigation', () => {
    it('puts transcript requests second and labels the student area', () => {
        expect(NAV_ITEMS.slice(0, 3).map((item) => item.label)).toEqual([
            'Dashboard',
            'Transcript Requests',
            'Student Information',
        ]);
    });
});