import { CategoryManager } from "../../generated/schema";

export function getCategoryManager(): CategoryManager {
  let categoryManager = CategoryManager.load('CATEGORIES');
  if (categoryManager == null) {
    categoryManager = new CategoryManager('CATEGORIES');
    categoryManager.categoryIndex = 0;
    categoryManager.poolsList = [];
    categoryManager.save();
  }
  return categoryManager as CategoryManager;
}