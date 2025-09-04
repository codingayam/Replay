import {
  Category,
  CategoryInfo,
  categoryMap,
  getNoteCategories,
  noteHasCategory,
  getCategoryInfo,
  getNoteCategoryInfos
} from '../../utils/categoryUtils';
import { noteFactory, categoryTestCases } from './testFactories';
import type { Note } from '../../types';

describe('categoryUtils', () => {
  describe('Category types and constants', () => {
    test('categoryMap contains correct category information', () => {
      expect(categoryMap.ideas).toEqual({
        name: 'ideas',
        color: '#7c3aed',
        backgroundColor: '#ede9fe',
      });

      expect(categoryMap.feelings).toEqual({
        name: 'feelings',
        color: '#059669', 
        backgroundColor: '#d1fae5',
      });
    });

    test('categoryMap only contains ideas and feelings', () => {
      const categories = Object.keys(categoryMap);
      expect(categories).toEqual(['ideas', 'feelings']);
      expect(categories).toHaveLength(2);
    });
  });

  describe('getNoteCategories', () => {
    test('returns array of categories when note has categories', () => {
      const noteWithIdeas = noteFactory.withIdeas();
      expect(getNoteCategories(noteWithIdeas)).toEqual(['ideas']);

      const noteWithFeelings = noteFactory.withFeelings();
      expect(getNoteCategories(noteWithFeelings)).toEqual(['feelings']);

      const noteWithBoth = noteFactory.withBoth();
      expect(getNoteCategories(noteWithBoth)).toEqual(['ideas', 'feelings']);
    });

    test('returns empty array when note has no categories', () => {
      const noteWithNull = noteFactory.withNull();
      expect(getNoteCategories(noteWithNull)).toEqual([]);

      const noteWithEmpty = noteFactory.withEmpty();
      expect(getNoteCategories(noteWithEmpty)).toEqual([]);
    });

    test('handles undefined note gracefully', () => {
      const undefinedNote = {} as Note;
      expect(getNoteCategories(undefinedNote)).toEqual([]);
    });
  });

  describe('noteHasCategory', () => {
    test('correctly identifies when note has specific category', () => {
      const noteWithIdeas = noteFactory.withIdeas();
      expect(noteHasCategory(noteWithIdeas, 'ideas')).toBe(true);
      expect(noteHasCategory(noteWithIdeas, 'feelings')).toBe(false);

      const noteWithBoth = noteFactory.withBoth();
      expect(noteHasCategory(noteWithBoth, 'ideas')).toBe(true);
      expect(noteHasCategory(noteWithBoth, 'feelings')).toBe(true);
    });

    test('returns false when note has no categories', () => {
      const noteWithNull = noteFactory.withNull();
      expect(noteHasCategory(noteWithNull, 'ideas')).toBe(false);
      expect(noteHasCategory(noteWithNull, 'feelings')).toBe(false);

      const noteWithEmpty = noteFactory.withEmpty();
      expect(noteHasCategory(noteWithEmpty, 'ideas')).toBe(false);
      expect(noteHasCategory(noteWithEmpty, 'feelings')).toBe(false);
    });
  });

  describe('getCategoryInfo', () => {
    test('returns correct info for ideas category', () => {
      const info = getCategoryInfo('ideas');
      expect(info).toEqual({
        name: 'ideas',
        color: '#7c3aed',
        backgroundColor: '#ede9fe',
      });
    });

    test('returns correct info for feelings category', () => {
      const info = getCategoryInfo('feelings');
      expect(info).toEqual({
        name: 'feelings',
        color: '#059669',
        backgroundColor: '#d1fae5',
      });
    });
  });

  describe('getNoteCategoryInfos', () => {
    test('returns array of category infos for note with single category', () => {
      const noteWithIdeas = noteFactory.withIdeas();
      const infos = getNoteCategoryInfos(noteWithIdeas);
      
      expect(infos).toHaveLength(1);
      expect(infos[0]).toEqual({
        name: 'ideas',
        color: '#7c3aed',
        backgroundColor: '#ede9fe',
      });
    });

    test('returns array of category infos for note with multiple categories', () => {
      const noteWithBoth = noteFactory.withBoth();
      const infos = getNoteCategoryInfos(noteWithBoth);
      
      expect(infos).toHaveLength(2);
      expect(infos[0]).toEqual({
        name: 'ideas',
        color: '#7c3aed',
        backgroundColor: '#ede9fe',
      });
      expect(infos[1]).toEqual({
        name: 'feelings',
        color: '#059669',
        backgroundColor: '#d1fae5',
      });
    });

    test('returns empty array for note with no categories', () => {
      const noteWithNull = noteFactory.withNull();
      const infos = getNoteCategoryInfos(noteWithNull);
      expect(infos).toEqual([]);

      const noteWithEmpty = noteFactory.withEmpty();
      const infosEmpty = getNoteCategoryInfos(noteWithEmpty);
      expect(infosEmpty).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    test('handles notes with duplicate categories', () => {
      const noteWithDuplicates = noteFactory.withIdeas({
        category: ['ideas', 'ideas', 'feelings'] as Category[]
      });
      
      const categories = getNoteCategories(noteWithDuplicates);
      expect(categories).toEqual(['ideas', 'ideas', 'feelings']);
      
      const infos = getNoteCategoryInfos(noteWithDuplicates);
      expect(infos).toHaveLength(3); // Should include duplicates
    });

    test('performance with large category arrays', () => {
      const largeCategoryArray = Array(1000).fill('ideas') as Category[];
      const noteWithManyCategories = noteFactory.withIdeas({
        category: largeCategoryArray
      });
      
      const start = performance.now();
      const categories = getNoteCategories(noteWithManyCategories);
      const infos = getNoteCategoryInfos(noteWithManyCategories);
      const end = performance.now();
      
      expect(categories).toHaveLength(1000);
      expect(infos).toHaveLength(1000);
      expect(end - start).toBeLessThan(10); // Should complete in less than 10ms
    });
  });

  describe('Type safety', () => {
    test('TypeScript compilation ensures type safety', () => {
      // These tests will fail at compile time if types are incorrect
      const validCategory: Category = 'ideas';
      const validCategoryArray: Category[] = ['ideas', 'feelings'];
      const validCategoryInfo: CategoryInfo = {
        name: 'test',
        color: '#000000',
        backgroundColor: '#ffffff'
      };

      expect(validCategory).toBeDefined();
      expect(validCategoryArray).toBeDefined();
      expect(validCategoryInfo).toBeDefined();
    });
  });
});