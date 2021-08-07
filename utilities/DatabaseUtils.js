/**
 * This file stores functions for interacting with local storage, beginning with general use APIs then covering data-object-specific functions
 * that use the below 3 APIs
*/

import AsyncStorage from '@react-native-async-storage/async-storage';
import {range} from './GeneralUtils'

export const storeObject = async (key,value) => {
    try {
      const jsonValue = JSON.stringify(value)
      await AsyncStorage.setItem(key, jsonValue)
    } 
    catch (e) {
      console.log("storeObject error: ", e);
    }
}

export const getObject = async (key) => {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch(e) {
      console.log("getObject error: ", e);
    }
}

export const removeObject = async (key) => {
    try {
      await AsyncStorage.removeItem(key)
    } catch(e) {
      console.log("removeObject error: ", e);
    }
}

export const getAllKeys = async () => {
    const allKeys = await AsyncStorage.getAllKeys(); 
    return allKeys;
}


/* Data-object specific utils */

/**
 * Beginning of Timeblock data utils
 * 
 * How timeblocks are stored and retreived:
 *      Two pieces of data:
 *          1. An array that holds the ids of all the timeblocks for a certain day *in order* with key `${formatted date string (ex: Wed_May_19_2021)}_TBOrder`
 *          2. An array that holds all timeblocks for a certain day with key `${formatted date string (ex: Wed_May_19_2021)}_TBData`
 * 
 *      So we'll get the date's array of ids -> get the array of timeblocks -> populate state.timeblocks with correct order of timeblocks
 * 
 * Example timeblock:
 * {
    id: 1,
    startTime: "05:00 PM",
    endTime: "06:00 PM",
    taskName: "Reading",
    minutes: 60,
    overlap: 0.0,
    category: 'General Education'
    }
 */

// getting the array of ordered timeblock IDs for the current day
export const getOrderedTimeblockIDs = async (dateString) => {

    // hard coded timeblocks and order for dev purposes
    //await storeObject(`${dateString}_TBData`, [{"category": null, "endTime": "6:30 PM", "id": 2, "minutes": 90, "overlap": null, "startTime": "5:00 PM", "taskName": "Chillen m8"}, {"category": null, "endTime": "7:00 PM", "id": 1, "minutes": 10, "overlap": 0, "startTime": "6:50 PM", "taskName": "Reading"}, {"category": null, "endTime": "7:35 PM", "id": 3, "minutes": 35, "overlap": null, "startTime": "7:00 PM", "taskName": "Grind"}, {"category": null, "endTime": "8:00 PM", "id": 4, "minutes": 10, "overlap": 0, "startTime": "7:50 PM", "taskName": "Killl"}, {"category": null, "endTime": "8:30 PM", "id": 5, "minutes": 30, "overlap": 0, "startTime": "8:00 PM", "taskName": "Grind"}, {"category": null, "endTime": "10:30 PM", "id": 6, "minutes": 115, "overlap": null, "startTime": "8:35 PM", "taskName": "Killl"}, {"category": null, "endTime": "10:45 PM", "id": 7, "minutes": 15, "overlap": 0, "startTime": "10:30 PM", "taskName": "Killl"}, {"category": null, "endTime": "11:30 PM", "id": 8, "minutes": 30, "overlap": 0, "startTime": "11:00 PM", "taskName": "Grind"}])
    //await storeObject(`${dateString}_TBOrder`, {ids:[2,1,3,4,5,6,7,8]})

    // await storeObject("lastTimeblockID", {id: 8})

    const orderedTimeblockIDs = await getObject(`${dateString}_TBOrder`)
        .then(idsObject => {
            return idsObject.ids;
        })
        .catch(e => {
            console.log("getOrderedTBIDs DB error: " + e)
            return [];
        })

    return orderedTimeblockIDs;
}

// get timeblocks for current date from DB (out of order)
export const getTimeblocks = async (dateString) => {

    // const allKeys = await getAllKeys()
    // console.log(allKeys) 

    const timeblocks = await getObject(`${dateString}_TBData`)
        .then(timeblocksObject => {
            return timeblocksObject;
        })
        .catch(e => {
            console.log("getTimeblocks error")
            return [];
        })

    return timeblocks;
}

export const storeNewTimeblock = async (newTimeblocks, newTimeblockID, dateString) => {
    // update lastTimeblockID
    if (newTimeblockID){
        await storeObject("lastTimeblockID", {id: newTimeblockID})
    }
    else{
        const oldLastTimeblockID = await getLastTimeblockID()
        newTimeblockID = oldLastTimeblockID + 1
        await storeObject("lastTimeblockID", {id: newTimeblockID})
    }

    // add new category to existingCategories
    await updateTimeblocksInDB(newTimeblocks, dateString)
}

export const updateTimeblocksInDB = async (newTimeblocks, dateString) => {
    await storeObject(`${dateString}_TBData`, newTimeblocks);
}

export const getLastTimeblockID = async () => {
    const id = await getObject("lastTimeblockID")
        .then(obj => {
            return obj.id
        })
        .catch(e => {
            console.log("getLastTimeblockID error")
            return 0
        })

    return id
}

export const updateOrderedTimeblockIDsInDB = async (newOrderedTimeblockIDs, dateString) => {
    await storeObject(`${dateString}_TBOrder`, {ids: newOrderedTimeblockIDs});
}

// takes dateString (ex: Wed May 11 2021) -> gets list of existing timeblocks for that date
export const getTimeblockScreenData = async (dateObject) => {

    // add underscores to dateString for the upcoming query
    const dateString = dateObject.toDateString().replaceAll(" ", "_").substring(4);
    
    // get array of timeblock ids in order (this is purely for order)
    const orderedTimeblockIDs = await getOrderedTimeblockIDs(dateString);    

    // get array of timeblock objects (out of order)
    const timeblocks = await getTimeblocks(dateString);

    // pushing timeblocks onto the array we will return according to orderedTimeblockIDs
    let orderedTimeblocks = [];
    for (id of orderedTimeblockIDs){
        for (i of range(timeblocks.length)){
            if (timeblocks[i].id == id){
                orderedTimeblocks.push(timeblocks[i]);
                break;
            }
        }
    }

    return {orderedTimeblockIDs: orderedTimeblockIDs, timeblocks: orderedTimeblocks};
}


/**
 * Beginning of taskName utils, which interact with the existingTaskNames object array and the lastTaskNameID integer object
 */

// get all previously created taskNames
export const getExistingTaskNames = async () => {

    // await storeObject("existingTaskNames", {taskNames: []})
    // await storeObject("lastTaskNameID", {id: 0})

    //  await storeObject("existingTaskNames", {taskNames: [
    //     {
    //         name: "Chillen m8", 
    //         id: 1
    //     }, 
    //     {
    //         name: "Reading",
    //         id: 2
    //     },
    //     {
    //         name: "Grind",
    //         id: 3
    //     },
    //     {
    //         name: "Killl",
    //         id: 4
    //     },
    //     {
    //         name: "Bruh",
    //         id: 5
    //     }
    // ]})
    // await storeObject("lastTaskNameID", {id: 5})

    const existingTaskNames = await getObject("existingTaskNames")
        .then(taskNamesObj => {
            return taskNamesObj.taskNames
        })
        .catch(e => {
            console.log(`Error while getting existingTaskNames: ${e}`)
            return []
        })
    
    return existingTaskNames;
}

export const storeNewTaskName = async (name, oldTaskNames, newTaskNameID) => {

    if (name.trim() == ""){
        return 
    }

    // update lastTaskNameID
    if (newTaskNameID){
        await storeObject("lastTaskNameID", {id: newTaskNameID})
    }
    else{
        const oldLastTaskNameID = await getLastTaskNameID()
        newTaskNameID = oldLastTaskNameID + 1
        await storeObject("lastTaskNameID", {id: newTaskNameID})
    }

    // add new category to existingCategories
    await updateTaskNamesInDB([...oldTaskNames, {
        name: name,
        id: newTaskNameID
    }])

    return {
        id: newTaskNameID,
        name: name
    }
}

export const updateTaskNamesInDB = async (newTaskNames) => {
    await storeObject("existingTaskNames", {taskNames: newTaskNames})
}

export const getLastTaskNameID = async () => {
    const id = await getObject("lastTaskNameID")
        .then(obj => {
            return obj.id
        })
        .catch(e => {
            console.log("getLastTaskNameID error")
            return 0
        })

    return id
}


/**
 * Beginning of category utils, which interact with the existingCategories object array and the lastTaskNameID integer object
 */

// get all previously created categories
export const getExistingCategories = async () => {

    // await storeObject("existingCategories", {categories: []})
    // await storeObject("lastCategoryID", {id: 0})

    // await storeObject("existingCategories", {categories: [
    //     {
    //         name: "Software Engineering",
    //         id: 1,
    //         color: "#00E6FF"
    //     },
    //     {
    //         name: "Neuroscience",
    //         id: 2,
    //         color: "#FF009A"
    //     },
    //     {
    //         name: "General Study",
    //         id: 3,
    //         color: "#00FFBC"
    //     }
    // ]})
    // await storeObject("lastCategoryID", {id: 3})

    const existingCategories = await getObject("existingCategories")
        .then(categoriesObj => {
            return categoriesObj.categories
        })
        .catch(e => {
            console.log("getExistingCategories error")
            return []
        })

    return existingCategories;
}

export const storeNewCategory = async (name, color, oldCategories, newCategoryID) => {
    
    if (name.trim() == ""){
        return
    }
    
    // update lastCategoryID
    if (newCategoryID){
        await storeObject("lastCategoryID", {id: newCategoryID})
    }
    else{
        const oldLastCategoryID = await getLastCategoryID()
        newCategoryID = oldLastCategoryID + 1
        await storeObject("lastCategoryID", {id: newCategoryID})
    }

    // add new category to existingCategories
    await updateCategoriesInDB([...oldCategories, {
        name: name,
        color: color,
        id: newCategoryID
    }])

    return {
        name: name,
        color: color,
        id: newCategoryID
    }
}

export const updateCategoriesInDB = async (newCategories) => {
    await storeObject("existingCategories", {categories: newCategories})
}

export const getLastCategoryID = async () => {
    //await storeObject("lastCategoryID", {id: 3})
    const id = await getObject("lastCategoryID")
        .then(obj => {
            return obj.id
        })
        .catch(e => {
            console.log("getLastCategoryID error")
            return 0
        })

    return id
}


/**
 * Beginning of screen-specific utils, which get multiple data objects
 */

// get existing categories and task names for the TimeblockModal
export const getTimeblockModalData = async () => {

    const existingCategories = await getExistingCategories()
    const existingTaskNames = await getExistingTaskNames()

    let categoryNames = []
    for (i of range(existingCategories.length)){
        categoryNames.push(existingCategories[i].name)
    }

    return {categories: existingCategories, taskNames: existingTaskNames, categoryNames: categoryNames}
}