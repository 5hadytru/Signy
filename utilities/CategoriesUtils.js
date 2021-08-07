import {
    updateCategoriesInDB,
    storeNewCategory
} from './DatabaseUtils'

// called on every render -> runs when the createCategoryFlag state variable is true
export const createNewCategory = (createCategoryFlag, setCreateCategoryFlag, lastCategoryID, setLastCategoryID, setCategories) => {
    if (createCategoryFlag){
        // set state to include this category which is empty; once the name is updated, we will hit the database
        const newCategoryID = lastCategoryID + 1;

        // update state: reset flag -> update lastCategoryID -> update categories
        setCreateCategoryFlag(false)
        setLastCategoryID(newCategoryID)
        setCategories(categories => {
            return [...categories, {
                name: "",
                color: "#ffffff",
                id: newCategoryID
            }]
        })
    }
}

// callback for right swiping on a category
export const deleteCategory = (categoryID, categories, setCategories) => {
    // get new array of categories
    const newCategories = categories.filter(category => {
        if (category.id == categoryID){
            return false
        }
        return true
    })

    // queue DB update -> update state
    updateCategoriesInDB(newCategories)
    setCategories(newCategories)
}

// callback for ColorPickerModal
export const updateCategoryColor = (categories, categoryID, newColor, setCategories) => {

    // get new array of categories
    let cachedCategory; // will be assigned to this category's object in state so we can check if the name is empty
    const newCategories = categories.map(category => {
        if (category.id == categoryID){
            cachedCategory = category
            category.color = newColor;
        }
        return category
    })

    // queue DB update if this category's name is not empty (cannot create category with empty name)) -> update state
    cachedCategory.name == "" ? console.log("Name is empty; not hitting DB") : updateCategoriesInDB(newCategories);
    setCategories(newCategories)
}

// callback for TextInput
export const updateCategoryName = async (categories, categoryID, newName, setCategories) => {

    if (!validateNewCategoryName(newName, categories)){
        return
    }

    // get new categories array and also initialize this category in the database if its name was previously blank in its state variable
    let initializeFlag = false;
    const newCategories = categories.map(category => {
        if (category.id == categoryID){

            if (category.name == ""){
                console.log("Initializing cat in the DB")
                initializeFlag = true
            }
            category.name = newName;
        }
        return category
    })
    initializeFlag ? await storeNewCategory(newName, category.color, categories, categoryID) : console.log("No need to initialize")

    // queue DB update -> update state
    await updateCategoriesInDB(newCategories)
    setCategories(newCategories)
}

// validate that a category name is not empty and doesnt already exist
export const validateNewCategoryName = (newName, categories) => {
    
    // if the category name was left blank
    if (newName.trim().length == 0){
        alert("Cannot create a category with no name")
        return false
    }

    // if this category name is already taken
    for (category of categories){
        if (category.name.trim() == newName.trim()){
            console.log("Taken")
            alert("This name has already been used. Not saving.")
            return false
        }
    }

    return true
}

// create array of names of categories
export const getCategoryNames = (categories) => {
    let categoryNames = [];

    for (category of categories){
        categoryNames.push(category.name)
    }
    
    return categoryNames;
}