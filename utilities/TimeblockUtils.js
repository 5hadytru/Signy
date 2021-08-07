/**
 * This file contains all the functions concerned with computing front-end Timeblock and TimeblockNumber properties
 * 
 * Does not involve database logic but can invoke database-hitting functions
 */

import {range} from './GeneralUtils'
import {
    storeNewTaskName,
    storeNewCategory,
    storeNewTimeblock,
    updateOrderedTimeblockIDsInDB,
    updateTimeblocksInDB,
    getTimeblockScreenData
    } from './DatabaseUtils'


// get the max amount of minutes the user can pull this timeblock upwards and downwards
export const getValidPullStates = (thisTBIndex, startTime, endTime, currentTimeblocks) => {
    
    // if this is the only timeblock, hardcode the upper limit to the starting hour and the lower limit to 999
    if (currentTimeblocks.length == 1){
        return {
            maxTopPullMinutes: getMinutesOfTimeString(startTime),
            maxBottomPullMinutes: getMinuteDifference(endTime, "11:55 PM")
        }
      }

      // if this timeblock is the first timeblock, the max upwards pull is to this timeblock's starting hour
      if (thisTBIndex == 0){
        return {
          maxTopPullMinutes: getMinutesOfTimeString(startTime),
          maxBottomPullMinutes: getMinuteDifference(endTime, currentTimeblocks[thisTBIndex + 1].startTime)
        }
      }
      // if this timeblock is the last timeblock, the max downwards pull is to the bottom of the screen
      // max upwards pull depends on if this is the only timeblock
      else if (thisTBIndex == currentTimeblocks.length - 1){ 
        return {
          maxTopPullMinutes: getMinuteDifference(currentTimeblocks[thisTBIndex - 1].endTime, startTime),
          maxBottomPullMinutes: getMinuteDifference(endTime, "11:55 PM")
        }
      }
      else{ // this is an intermediate timeblock
        return {
          maxTopPullMinutes: getMinuteDifference(currentTimeblocks[thisTBIndex - 1].endTime, startTime),
          maxBottomPullMinutes: getMinuteDifference(endTime, currentTimeblocks[thisTBIndex + 1].startTime)
        }
      }
}


// check if route.params.datetime contains a clicked date (on the calendar) -> get timeblocks -> set state and hit DB
export const getTimeblocks = (routeParams, currentDate, mainDispatch) => {

    if (routeParams){ // check if route.params contains a clicked date that doesnt match the default mainState date (which is the current date for now)

        // extracting the last number of the day of the month that was clicked on
        const clickedDay = parseInt(routeParams.datetime.slice(8,));
        let processedDate = routeParams.datetime.slice(0,8);

        if (clickedDay < 10){
            processedDate += "0"
        }

        let paramsDate;
        // if (routeParams.manual){
        //     paramsDate = new Date(processedDate + clickedDay.toString())
        // }
        // else{
            //if (new Date(processedDate + `${clickedDay + 1}`).toDateString() == "Invalid Date"){
                paramsDate = new Date(processedDate + clickedDay.toString())
                paramsDate = new Date(paramsDate.getTime() + 86400000)
            // }
            // else{
            //     paramsDate = new Date(processedDate + `${clickedDay + 1}`)
            // }
        //}

        // if the route params contain a different date or TimeblockScreen just mounted and the clicked date (on the calendar) doesnt match the initial state of 'date'
        if (paramsDate.toDateString() != currentDate.toDateString()){
            mainDispatch({
                type: "set date",
                payload: paramsDate
            })
        }

        getTimeblockScreenData(paramsDate)
                .then(timeblockData => {
                    mainDispatch({
                        type: 'set timeblocks + order', 
                        payload: {
                            timeblocks: timeblockData.timeblocks, 
                            orderedTimeblockIDs: timeblockData.orderedTimeblockIDs
                        }})
                })
                .catch(e => {
                    console.log("Error in getTimeblocks: ", e.message())
                })
    }
    else{
        console.log("Route params NOT present");

        getTimeblockScreenData(currentDate)
                .then(timeblockData => {
                    mainDispatch({
                        type: 'set timeblocks + order', 
                        payload: {
                            timeblocks: timeblockData.timeblocks, 
                            orderedTimeblockIDs: timeblockData.orderedTimeblockIDs
                        }})
                })
                .catch(e => {
                    console.log("Error in in getTimeblocks: ", e.message())
                })
    }
}


export const executeDragAndDrop = (dropzoneObj, droppedTBIndex, userDraggedUp, timeblocks, orderedTimeblockIDs, mainDispatch, currentDate) => {
    /*
        postDragAndDropData = {
            newStartTime,
            newEndTime,
            distFromAboveTB,
            shiftData: {
                range: { // range of timeblock indices to shift by shiftAmt minutes; end is non-inclusive
                    start,
                    end
                }
                shiftAmt // minutes to shift the timeblocks by
            }
        }
    */
    const postDragAndDropData = getPostDragAndDropData(
        dropzoneObj.dropzoneIndex,
        dropzoneObj.onUpperTB,
        dropzoneObj.onLowerTB,
        dropzoneObj.dropzoneProportion,
        droppedTBIndex,
        userDraggedUp,
        timeblocks
    )

    // ensuring that the drag n drop didnt result in this timeblock spilling over into the previous or next day
    // we'll apply the actual changes without mutating mainState (useReducer vars are mutable lmao)
    if (dropzoneObj.dropzoneIndex == timeblocks.length - 1){ // user dropped below the last timeblock
        // new endTime is past midnight the next day
        if (postDragAndDropData.newEndTime.substring(postDragAndDropData.newEndTime.length - 2) == "AM"){
            alert("This would cause this timeblock to spill into the next day; aborting.")
            return
        }
    }
    else if (dropzoneObj.dropzoneIndex == 0){ // dropped above first timeblock
        // new startTime is in the previous day
        if (postDragAndDropData.newStartTime.substring(postDragAndDropData.newStartTime.length - 2) == "PM"
                && timeblocks[0].startTime.substring(timeblocks[0].startTime.length - 2) == "AM"){
            alert("This would cause this timeblock to spill into the previous day; aborting.")
            return
        }
    }

    // manually generate new orderedTimeblockIDs to save time
    let newOrderedTimeblockIDs = orderedTimeblockIDs.filter(id => id != timeblocks[droppedTBIndex].id)

    userDraggedUp ? newOrderedTimeblockIDs.insert(dropzoneObj.dropzoneIndex, timeblocks[droppedTBIndex].id) :
            newOrderedTimeblockIDs.insert(dropzoneObj.dropzoneIndex, timeblocks[droppedTBIndex].id)

    // get a copy of the timeblocks state variable with the dropped timeblock updated
    let newTimeblocks = updateOneTimeblockInArray(
        timeblocks,
        timeblocks[droppedTBIndex].id,
        timeblocks[droppedTBIndex].taskName,
        postDragAndDropData.newStartTime,
        postDragAndDropData.newEndTime,
        timeblocks[droppedTBIndex].category
    )

    // shift some timeblocks by shiftAmt minutes if necessary
    if (postDragAndDropData.shiftData){
        newTimeblocks = shiftTimeblocks(
            postDragAndDropData.shiftData.range.start,
            postDragAndDropData.shiftData.range.end,
            newTimeblocks,
            postDragAndDropData.shiftData.shiftAmt
        )
    }

    // reorder newTimeblocks
    let droppedTimeblock = timeblocks[droppedTBIndex]
    newTimeblocks = newTimeblocks.filter(tb => tb.id != timeblocks[droppedTBIndex].id)

    userDraggedUp ? newTimeblocks.insert(dropzoneObj.dropzoneIndex, droppedTimeblock) :
            newTimeblocks.insert(dropzoneObj.dropzoneIndex, droppedTimeblock)

    // set state with new timeblocks; must rerender the whole page to get spacing and displayed times right
    mainDispatch({
        type: "set timeblocks + order",
        payload: {
            timeblocks: newTimeblocks,
            orderedTimeblockIDs: newOrderedTimeblockIDs
        }
    })

    // save timeblocks and new order to DB
    const dateString = currentDate.toDateString().replaceAll(" ", "_").substring(4);
    updateTimeblocksInDB(newTimeblocks, dateString)
    updateOrderedTimeblockIDsInDB(newOrderedTimeblockIDs, dateString)
}


export const getMinutesOfTimeString = (timeString) => {
    const colonIndex = timeString.indexOf(":")
    return parseInt(timeString.substring(colonIndex + 1, colonIndex + 3))
}


// remove a timeblock from state and hit the database
export const deleteTimeblock = async (timeblockID, timeblocks, orderedTimeblockIDs, dateObj, mainDispatch) => {
    // remove the timeblock from mainState
    const newTimeblocks = timeblocks.filter(tb => tb.id != timeblockID)
    const newOrderedTimeblockIDs = orderedTimeblockIDs.filter(id => id != timeblockID)

    mainDispatch({
        type: "set timeblocks + order",
        payload: {
            timeblocks: newTimeblocks,
            orderedTimeblockIDs: newOrderedTimeblockIDs
        }
    })

    // save timeblocks and new order to DB
    const dateString = dateObj.toDateString().replaceAll(" ", "_").substring(4);
    await updateTimeblocksInDB(newTimeblocks, dateString)
    await updateOrderedTimeblockIDsInDB(newOrderedTimeblockIDs, dateString)
}


/**
 * 
 * @param {number} yOffset 
 *      absolute y coord of the dbl click
 * @param {Array} timeblockLayoutData 
 *      array of heights and y offsets for each timeblock
 * @param {Array} existingTimeblocks 
 *      reference to mainState.timeblocks so we can copy it
 * @param {number} lastTBID 
 *      last created timeblock's id; will increment this
 * @param {Array} existingOrderedTimeblockIDs 
 *      reference to mainState.orderedTimeblockIDs so we can copy it
 * @param {Function} mainDispatch 
 * @returns {void}
 */
export const createTimeblock = async (yOffset, timeblockLayoutData, existingTimeblocks, lastTBID, existingOrderedTimeblockIDs, mainDispatch, dateString) => {

    if (existingTimeblocks.length == 0){

        // set state and hit the database
        mainDispatch({
            type: "set timeblocks + order",
            payload: {
                timeblocks: [{ 
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: "9:00 AM", 
                    endTime: "9:30 AM", 
                    minutes: 30, 
                    overlap: null,
                    category: "",
                }],
                orderedTimeblockIDs: [lastTBID + 1]
            }
        })

        // save timeblocks and new order to DB
        dateString = dateString.replaceAll(" ", "_").substring(4);
        await storeNewTimeblock([{ 
            id: lastTBID + 1, 
            taskName: "",
            startTime: "9:00 AM", 
            endTime: "9:30 AM", 
            minutes: 30, 
            overlap: null,
            category: "",
        }], lastTBID + 1, dateString)
        await updateOrderedTimeblockIDsInDB([lastTBID + 1], dateString)

        return
    }

    // compute new timeblock's object + shift data
    const newTimeblockData = getCreateTimeblockData(yOffset, timeblockLayoutData, existingTimeblocks, lastTBID)

    let newTimeblocks = existingTimeblocks.map(tb => ({...tb}))

    // shift existingTimeblocks as necessary
    let startOfShift;
    let endOfShift;
    if (newTimeblockData.shiftAmt > 0){

        if (newTimeblockData.closestJunction.aboveTB){
            startOfShift = newTimeblockData.closestJunction.closestTBIndex
        }
        else {
            startOfShift = newTimeblockData.closestJunction.closestTBIndex + 1
        }
        endOfShift = -1
    }
    else if (newTimeblockData.shiftAmt < 0){

        if (newTimeblockData.aboveTB){
            endOfShift = newTimeblockData.closestJunction.closestTBIndex - 1
        }
        else {
            endOfShift = newTimeblockData.closestJunction.closestTBIndex
        }
        startOfShift = -1
    }

    newTimeblocks = shiftTimeblocks(startOfShift, endOfShift, newTimeblocks, newTimeblockData.shiftAmt)

    // if shifting would have caused a timeblock to spill into a diff day (an empty array is returned by shiftTimeblocks)
    if (newTimeblocks.length == 0){
        return 
    }

    // insert new timeblock into timeblocks and order arrays
    let newOrderedTimeblockIDs = [...existingOrderedTimeblockIDs]
    if (newTimeblockData.closestJunction.aboveTB){
        newTimeblocks.insert(newTimeblockData.closestJunction.closestTBIndex, newTimeblockData.newTB)
        newOrderedTimeblockIDs.insert(newTimeblockData.closestJunction.closestTBIndex, newTimeblockData.newTB.id)
    }
    else{
        newTimeblocks.insert(newTimeblockData.closestJunction.closestTBIndex + 1, newTimeblockData.newTB)
        newOrderedTimeblockIDs.insert(newTimeblockData.closestJunction.closestTBIndex + 1, newTimeblockData.newTB.id)
    }

    // set state and hit the database
    mainDispatch({
        type: "set timeblocks + order",
        payload: {
            timeblocks: newTimeblocks,
            orderedTimeblockIDs: newOrderedTimeblockIDs
        }
    })

    // save timeblocks and new order to DB
    dateString = dateString.replaceAll(" ", "_").substring(4);
    await storeNewTimeblock(newTimeblocks, newTimeblockData.newTB.id, dateString)
    await updateOrderedTimeblockIDsInDB(newOrderedTimeblockIDs, dateString)
}


/**
 * @param {number} yOffset 
 *      Distance of double click from top of ScrollView
 * @param {Array} timeblockLayoutData 
 *      heights and yOffsets of each timeblock
 * @param {Array} existingTimeblocks
 *      Existing timeblocks
 * @param {number} lastTBID 
 *      ID of last created timeblock
 * 
 * This will be handled similar to drag and drop
 */
export const getCreateTimeblockData = (yOffset, timeblockLayoutData, existingTimeblocks, lastTBID) => {

    // the user double clicked on the header
    if (yOffset < 0) { yOffset = 0 } 

    // get the nearest inter-timeblock junction
    let minDistance = 50000
    let closestJunction = {
        closestTBIndex: null,
        aboveTB: null
    }
    for (let i = 0; i < timeblockLayoutData.length; i++){
        
        const distanceFromTopOfTB = Math.abs(timeblockLayoutData[i].yOffset - yOffset)
        const distanceFromBottomOfTB = Math.abs(timeblockLayoutData[i].yOffset + timeblockLayoutData[i].heightPx - yOffset)

        if (distanceFromTopOfTB > minDistance){ // the last iterated timeblock was the closest
            break
        }
        else if (distanceFromTopOfTB > distanceFromBottomOfTB){
            closestJunction.closestTBIndex = i
            closestJunction.aboveTB = false
            minDistance = distanceFromBottomOfTB
        }
        else{ // if the top of this timeblock is closer to the touch than the bottom, the top is the closestb junction to the dbl click
            closestJunction.closestTBIndex = i
            closestJunction.aboveTB = true
            break
        }
    }

    // this var will hold the amount that we have to shift the timeblocks below the new timeblock (will only shift while necessary)
    let shiftAmt = 0;

    /* 
        the first two branches will handle the first and last timeblock being nearest to the dbl click, respectively
    */
    if (closestJunction.closestTBIndex == 0 && closestJunction.aboveTB){

        const firstTBStartTimeMins = getMinutesOfTimeString(existingTimeblocks[0].startTime)

        // if the first timeblock's startTime is close to 12AM handle differently 
        if (getTimeStringStartingHour(existingTimeblocks[0].startTime) == "12:00 AM"){
            if (firstTBStartTimeMins <= 5){ // make the tb 5 mins and shift as necessary
                return {
                    newTB: { 
                        id: lastTBID + 1, 
                        taskName: "",
                        startTime: "12:00 AM", 
                        endTime: "12:05 AM", 
                        minutes: 5, 
                        overlap: 0,
                        category: "",
                    },
                    shiftAmt: 5 - firstTBStartTimeMins,
                    closestJunction: closestJunction
                }
            }
            else if (firstTBStartTimeMins <= 30){ // make the new timeblock start at 12am and touch the first timeblock
                return {
                    newTB: { 
                        id: lastTBID + 1, 
                        taskName: "",
                        startTime: "12:00 AM", 
                        endTime: existingTimeblocks[0].startTime, 
                        minutes: firstTBStartTimeMins, 
                        overlap: 0,
                        category: "",
                    },
                    shiftAmt: 0,
                    closestJunction: closestJunction
                }
            }
            else{ // place the center of the timeblock where the user dbl clicked if possible
                if (yOffset <= 20){ // new timeblock will start at 12am and be 30 mins
                    return {
                        newTB: { 
                            id: lastTBID + 1, 
                            taskName: "",
                            startTime: "12:00 AM", 
                            endTime: "12:30 AM", 
                            minutes: 30, 
                            overlap: null,
                            category: "",
                        },
                        shiftAmt: 0,
                        closestJunction: closestJunction
                    }
                }
                else if (timeblockLayoutData[0].yOffset - yOffset <= 20){ // new timeblock will end at the first timeblock and be 30 mins
                    return {
                        newTB: { 
                            id: lastTBID + 1, 
                            taskName: "",
                            startTime: addMinutesToTimeString(existingTimeblocks[0].startTime, -30), 
                            endTime: existingTimeblocks[0].startTime, 
                            minutes: 30, 
                            overlap: null,
                            category: "",
                        },
                        shiftAmt: 0,
                        closestJunction: closestJunction
                    }
                }
                else{ // we can place the middle of the timeblock where the user dbl clicked
                    let newTBStartTimeMinutesFromFirstTB = Math.ceil((timeblockLayoutData[0].yOffset - yOffset) + 15)
                    const newTBStartTimeMinutesFromFirstTBMod5 = newTBStartTimeMinutesFromFirstTB % 5
                    newTBStartTimeMinutesFromFirstTB +=  newTBStartTimeMinutesFromFirstTBMod5 > 0 ? 5 - (newTBStartTimeMinutesFromFirstTBMod5) 
                                                                                                : 0
                    const newTBStartTime = addMinutesToTimeString(existingTimeblocks[0].startTime, -newTBStartTimeMinutesFromFirstTB)

                    return {
                        newTB: { 
                            id: lastTBID + 1, 
                            taskName: "",
                            startTime: newTBStartTime, 
                            endTime: addMinutesToTimeString(newTBStartTime, 30), 
                            minutes: 30, 
                            overlap: null,
                            category: "",
                        },
                        shiftAmt: 0,
                        closestJunction: closestJunction
                    }
                }
            }
        }
        // if there are <=15 mins available before the first timeblock (on the screen) or placing the center of the timeblock at the dbl click would
        // lead to overlap, just place the new timeblock's endTime at the startTime of the first timeblock
        else if ((firstTBStartTimeMins <= 15) || ((yOffset + 20) >= timeblockLayoutData[0].yOffset)){

            // round new endTime down to nearest multiple of 5 if necessary
            if (firstTBStartTimeMins % 5){
                const newTBEndTime = addMinutesToTimeString(existingTimeblocks[0].startTime, -(5 - (firstTBStartTimeMins % 5)))
                return {
                    newTB: { 
                        id: lastTBID + 1, 
                        taskName: "",
                        startTime: addMinutesToTimeString(newTBEndTime, -30), 
                        endTime: newTBEndTime, 
                        minutes: 30, 
                        overlap: null,
                        category: "",
                    },
                    shiftAmt: 0,
                    closestJunction: closestJunction
                }
            }

            return {
                newTB: { 
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: addMinutesToTimeString(existingTimeblocks[0].startTime, -30), 
                    endTime: existingTimeblocks[0].startTime, 
                    minutes: 30, 
                    overlap: null,
                    category: "",
                },
                shiftAmt: 0,
                closestJunction: closestJunction
            }
        }
        else{ // there is room to place the center of the new timeblock at the yOffset of the dbl click
            let newTBStartTimeMinutesFromFirstTB = Math.ceil(timeblockLayoutData[0].yOffset - yOffset + 15)
            const newTBStartTimeMinutesFromFirstTBMod5 = newTBStartTimeMinutesFromFirstTB % 5
            newTBStartTimeMinutesFromFirstTB +=  newTBStartTimeMinutesFromFirstTBMod5 > 0 ? 5 - (newTBStartTimeMinutesFromFirstTBMod5) 
                                                                                          : 0
            const newTBStartTime = addMinutesToTimeString(existingTimeblocks[0].startTime, -newTBStartTimeMinutesFromFirstTB)

            return {
                newTB: { 
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: newTBStartTime, 
                    endTime: addMinutesToTimeString(newTBStartTime, 30), 
                    minutes: 30, 
                    overlap: null,
                    category: "",
                },
                shiftAmt: 0,
                closestJunction: closestJunction
            }
        }
    }


    /* 
        The user's dbl click was closest to the bottom of the last timeblock
    */
    else if (closestJunction.closestTBIndex == timeblockLayoutData.length - 1 && !closestJunction.aboveTB){

        const lastTBEndTimeMins = getMinutesOfTimeString(existingTimeblocks[closestJunction.closestTBIndex].endTime)
        const bottomOfLastTBPx = timeblockLayoutData[closestJunction.closestTBIndex].yOffset + timeblockLayoutData[closestJunction.closestTBIndex].heightPx

        // if the last timeblock's endTime is close to 12AM handle differently
        if (getTimeStringStartingHour(existingTimeblocks[closestJunction.closestTBIndex].endTime) == "11:00 PM"){

            const lastTBEndTimeMinsFrom11pm = lastTBEndTimeMins  
            const lastTBEndTimeMinsFrom1159pm = 59 - lastTBEndTimeMinsFrom11pm 

            if (lastTBEndTimeMinsFrom1159pm <= 5){
                return {
                    newTB: { 
                        id: lastTBID + 1, 
                        taskName: "",
                        startTime: "11:50 PM", 
                        endTime: "11:55 PM", 
                        minutes: 5, 
                        overlap: 0,
                        category: "",
                    },
                    shiftAmt: -(lastTBEndTimeMinsFrom11pm - 50),
                    closestJunction: closestJunction
                }
            }
            else if (lastTBEndTimeMinsFrom1159pm <= 34){

                let newTBStartTime = existingTimeblocks[closestJunction.closestTBIndex].endTime
                if (lastTBEndTimeMins % 5){
                    addMinutesToTimeString(newTBStartTime, 5 - (lastTBEndTimeMinsFrom1159pm % 5))
                }

                return {
                    newTB: { 
                        id: lastTBID + 1, 
                        taskName: "",
                        startTime: existingTimeblocks[closestJunction.closestTBIndex].endTime, 
                        endTime: "11:55 PM", 
                        minutes: lastTBEndTimeMinsFrom1159pm - 4, 
                        overlap: 0,
                        category: "",
                    },
                    shiftAmt: 0,
                    closestJunction: closestJunction
                }
            }
            else{ // place the center of the timeblock where the user dbl clicked if possible

                if ((yOffset - bottomOfLastTBPx) <= 20){ // new timeblock will start at the end of the last TB and be 30 mins

                    let newTBStartTime = existingTimeblocks[closestJunction.closestTBIndex].endTime
                    if (lastTBEndTimeMins % 5){
                        addMinutesToTimeString(newTBStartTime, 5 - (lastTBEndTimeMinsFrom1159pm % 5))
                    }

                    return {
                        newTB: { 
                            id: lastTBID + 1, 
                            taskName: "",
                            startTime: newTBStartTime, 
                            endTime: addMinutesToTimeString(newTBStartTime, 30), 
                            minutes: 30, 
                            overlap: 0,
                            category: "",
                        },
                        shiftAmt: 0,
                        closestJunction: closestJunction
                    }
                } 
                else if (yOffset > (bottomOfLastTBPx + lastTBEndTimeMinsFrom1159pm - 20)){ // new timeblock will end at 11:55pm and be 30 mins
                    return {
                        newTB: { 
                            id: lastTBID + 1, 
                            taskName: "",
                            startTime: "11:25 PM", 
                            endTime: "11:55 PM", 
                            minutes: 30, 
                            overlap: 0,
                            category: "",
                        },
                        shiftAmt: 0,
                        closestJunction: closestJunction
                    }
                }
                else{ // the user's dbl click yCoord is valid for dynamic placement
                    let newTBStartTimeMinutesFromLastTBEnd = Math.floor(yOffset - bottomOfLastTBPx - 15)
                    const newTBStartTimeMinutesFromLastTBEndMod5 = newTBStartTimeMinutesFromLastTBEnd % 5
                    newTBStartTimeMinutesFromLastTBEnd +=  newTBStartTimeMinutesFromLastTBEndMod5 > 0 ? 5 - (newTBStartTimeMinutesFromLastTBEndMod5) 
                                                                                          : 0
                    const newTBStartTime = addMinutesToTimeString(existingTimeblocks[closestJunction.closestTBIndex].endTime, newTBStartTimeMinutesFromLastTBEnd)

                    return {
                        newTB: { 
                            id: lastTBID + 1, 
                            taskName: "",
                            startTime: newTBStartTime, 
                            endTime: addMinutesToTimeString(newTBStartTime, 30), 
                            minutes: 30, 
                            overlap: null,
                            category: "",
                        },
                        shiftAmt: 0,
                        closestJunction: closestJunction
                    }
                }

            }
        }
        else if ((yOffset - bottomOfLastTBPx) < 20){ // the location of the dbl click was close enough to the last TB to elicit touching

            const newTBStartTime = existingTimeblocks[closestJunction.closestTBIndex].endTime

            return {
                newTB: { 
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: newTBStartTime, 
                    endTime: addMinutesToTimeString(newTBStartTime, 30), 
                    minutes: 30, 
                    overlap: null,
                    category: "",
                },
                shiftAmt: 0,
                closestJunction: closestJunction
            }
        }
        else{ // dbl click was far enough from the last timeblock to elicit dynamic placement

            let newTBStartTimeMinutesFromLastTBEnd = Math.floor(yOffset - bottomOfLastTBPx - 15)
            const newTBStartTimeMinutesFromLastTBEndMod5 = newTBStartTimeMinutesFromLastTBEnd % 5
            newTBStartTimeMinutesFromLastTBEnd +=  newTBStartTimeMinutesFromLastTBEndMod5 > 0 ? 5 - (newTBStartTimeMinutesFromLastTBEndMod5) 
                                                                                                : 0
            let newTBStartTime = addMinutesToTimeString(existingTimeblocks[closestJunction.closestTBIndex].endTime, newTBStartTimeMinutesFromLastTBEnd)
            let newTBEndTime;

            // if this led to an endTime mistakenly past 12 AM
            if (getTimeStringStartingHour(newTBStartTime) == "11:00 PM" && 
                    getMinutesOfTimeString(newTBStartTime) > 25){
                
                newTBStartTime = "11:25 PM"
                newTBEndTime = "11:55 PM"
            }
            else{
                newTBEndTime = addMinutesToTimeString(newTBStartTime, 30)
            }

            return {
                newTB: { 
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: newTBStartTime, 
                    endTime: newTBEndTime, 
                    minutes: 30, 
                    overlap: null,
                    category: "",
                },
                shiftAmt: 0,
                closestJunction: closestJunction
            }
        }
    }


    /* 
        making it to this point means the dbl click was closest to an intermediate timeblock junction
    */

    // specify the indices of the upper and lower timeblock depending on if the closest timeblock was above or below the dbl click
    let upperTBEndTime;
    let lowerTBStartTime;

    if (closestJunction.aboveTB){
        upperTBEndTime = existingTimeblocks[closestJunction.closestTBIndex - 1].endTime
        lowerTBStartTime = existingTimeblocks[closestJunction.closestTBIndex].startTime
    }
    else{
        upperTBEndTime = existingTimeblocks[closestJunction.closestTBIndex].endTime
        lowerTBStartTime = existingTimeblocks[closestJunction.closestTBIndex + 1].startTime
    }

    // the new timeblock will have minutes equal to the minute difference of the timeblocks that make up the juncture; min = 5min, max = 30min
    const sizeOfJunction = getMinuteDifference(upperTBEndTime, lowerTBStartTime)
    const upperTBEndTimeModulo5 = getMinutesOfTimeString(upperTBEndTime) % 5
    const lowerTBStartTimeModulo5 = getMinutesOfTimeString(lowerTBStartTime) % 5

    // these three branches handle dbl clicks that occur between two timeblocks
    if (sizeOfJunction <= 30 && sizeOfJunction >= 5){ // squeeze the timeblock in there while smoothing the startTime and endTime to multiples of 5 without making its length less than 5
        if (upperTBEndTimeModulo5 == 0 && lowerTBStartTimeModulo5 == 0){ // we can slide it in there perfectly
            return {
                newTB: { 
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: upperTBEndTime, 
                    endTime: lowerTBStartTime, 
                    minutes: sizeOfJunction, 
                    overlap: getTimeblockOverlap(upperTBEndTime, sizeOfJunction),
                    category: "",
                },
                shiftAmt: 0,
                closestJunction: closestJunction
            }
        }
        else{ // gotta round to 5s for the startTime (round up) and endTime (round down) then may have to shift (if the rounding brings the new TB's length to <5)
            const newTBStartTime = upperTBEndTimeModulo5 == 0 ? upperTBEndTime : addMinutesToTimeString(upperTBEndTime, 5 - upperTBEndTimeModulo5) 
            let newTBEndTime =  lowerTBStartTimeModulo5 == 0 ? lowerTBStartTime : addMinutesToTimeString(lowerTBStartTime, -lowerTBStartTimeModulo5) 

            // ensuring the rounding did not shrink the new timeblock to 0 minutes
            let newTBMinutes = getMinuteDifference(newTBStartTime, newTBEndTime)
            if (newTBMinutes < 5){
                shiftAmt = 5
                newTBEndTime = addMinutesToTimeString(newTBStartTime, 5)
                newTBMinutes = 5
            }

            return {
                newTB: {
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: newTBStartTime, 
                    endTime: newTBEndTime, 
                    minutes: newTBMinutes, 
                    overlap: getTimeblockOverlap(newTBStartTime, newTBMinutes),
                    category: ""
                },
                shiftAmt: shiftAmt,
                closestJunction: closestJunction
            }
        }
    }
    else if (sizeOfJunction < 5){

        // make the timeblock's length 5 and shift the lower blocks by the diff between 5 and sizeOfJunction
        const newTBEndTime = addMinutesToTimeString(upperTBEndTime, 5)
        shiftAmt = 5 - sizeOfJunction

        return {
            newTB: {
                id: lastTBID + 1, 
                taskName: "",
                startTime: upperTBEndTime, 
                endTime: newTBEndTime, 
                minutes: 5, 
                overlap: getTimeblockOverlap(upperTBEndTime, 5),
                category: ""
            },
            shiftAmt: shiftAmt,
            closestJunction: closestJunction
        }
    }
    else{ // sizeOfJunction is >30 so we will place the new timeblock's center at the y coord of the dbl click if possible

        // get y coords of upper and lower bounds of junction
        let bottomOfUpperTB;
        let topOfLowerTB;

        if (closestJunction.aboveTB){
            bottomOfUpperTB = timeblockLayoutData[closestJunction.closestTBIndex - 1].yOffset + timeblockLayoutData[closestJunction.closestTBIndex - 1].heightPx
            topOfLowerTB = timeblockLayoutData[closestJunction.closestTBIndex].yOffset
        }
        else{
            bottomOfUpperTB = timeblockLayoutData[closestJunction.closestTBIndex].yOffset + timeblockLayoutData[closestJunction.closestTBIndex].heightPx
            topOfLowerTB = timeblockLayoutData[closestJunction.closestTBIndex + 1].yOffset
        }

        if (topOfLowerTB - yOffset < 20){ // the new timeblock would overlap the lower timeblock
            return {
                newTB: {
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: addMinutesToTimeString(lowerTBStartTime, -30), 
                    endTime: lowerTBStartTime, 
                    minutes: 30, 
                    overlap: null, // we only need overlap for timeblocks <20mins
                    category: ""
                },
                shiftAmt: 0,
                closestJunction: closestJunction
            }
        }
        else if (yOffset - bottomOfUpperTB < 20){ // the new timeblock would overlap the upper timeblock
            return {
                newTB: {
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: upperTBEndTime, 
                    endTime: addMinutesToTimeString(upperTBEndTime, 30), 
                    minutes: 30, 
                    overlap: null, // we only need overlap for timeblocks <20mins
                    category: ""
                },
                shiftAmt: 0,
                closestJunction: closestJunction
            }
        }
        else{ // place the center of the timeblock where the dbl click occured
            let newTBMinutesFromUpperTB = Math.floor(yOffset - bottomOfUpperTB - 15)
            const newTBMinutesFromUpperTBMod5 = newTBMinutesFromUpperTB % 5
            newTBMinutesFromUpperTB += newTBMinutesFromUpperTBMod5 > 0 ? 5 - newTBMinutesFromUpperTBMod5
                                                                       : 0
            const newTBStartTime = addMinutesToTimeString(upperTBEndTime, newTBMinutesFromUpperTB)

            return {
                newTB: {
                    id: lastTBID + 1, 
                    taskName: "",
                    startTime: newTBStartTime, 
                    endTime: addMinutesToTimeString(newTBStartTime, 30), 
                    minutes: 30, 
                    overlap: null, // we only need overlap for timeblocks <20mins
                    category: ""
                },
                shiftAmt: 0,
                closestJunction: closestJunction
            }
        }
    }
}


// from a timeString with (ex: "04:50 PM", "011:59 PM") or without a leading zero, get the start hour (ex: "4 PM", "11 PM")
export const getTimeStringStartingHour = (timeString) => {
    return timeString.substring(0, timeString.indexOf(":")) + ":00" + timeString.substring(timeString.indexOf(":") + 3)
}

/* create list of layoutData of the form: 
    {
        id: timeblock id
        yOffset: offset from the top of the ScrollView
        heightPx: height of timeblock in px
    }
*/
export const computeLayoutData = (timeblocks) => {

    if (!timeblocks || timeblocks.length == 0){
        return []
    }

    let layoutData = []

    // push the first timeblock's layout data
    const firstTBHeight = timeblocks[0].minutes > 30 ? timeblocks[0].minutes : 30
    let currentYOffset = getMinutesOfTimeString(timeblocks[0].startTime)
    layoutData.push({
        heightPx: firstTBHeight,
        id: timeblocks[0].id,
        yOffset: currentYOffset
    })
    currentYOffset += firstTBHeight

    // push the rest
    for (let i=1; i<timeblocks.length; i++){

        currentYOffset += getMinuteDifference(timeblocks[i - 1].endTime, timeblocks[i].startTime)

        const thisTBHeightPx = timeblocks[i].minutes > 30 ? timeblocks[i].minutes : 30
        layoutData.push({
            heightPx: thisTBHeightPx,
            id: timeblocks[i].id,
            yOffset: currentYOffset
        })
        currentYOffset += thisTBHeightPx
    }

    return layoutData
}

// shift timeblocks in an open or close-ended range by shiftAmt minutes
export const shiftTimeblocks = (start, end, oldTimeblocks, shiftAmt) => {

    // caching oldTimeblocks in case shifting down (branch 1) fails and we need the oldTimeblocks for trying to shift up (branch 2)
    const cachedOldTimeblocks = oldTimeblocks

    // for the first two branches, start/end are inclusive
    if (end == -1){ // start shifting down at oldTimeblocks[start] and break once there is no overlap

        let newTimeblocks = []

        let i;
        for (i = 0; i < start; i++){ // add the out-of-range timeblocks to newTimeblocks
            newTimeblocks.push(oldTimeblocks[i])
        }

        // shifting timeblocks and appending them to newTimeblocks
        let currentTBIndex = start
        do {
            // if we're about to shift the last timeblock
            if (currentTBIndex == oldTimeblocks.length - 1){

                // if shifting the last timeblock would cause it to spill over into the next day
                if (getTimeStringStartingHour(oldTimeblocks[oldTimeblocks.length - 1].endTime) == "11:00 PM"
                        && (59 - getMinutesOfTimeString(oldTimeblocks[oldTimeblocks.length - 1].endTime) < shiftAmt)){

                    if (start > 1){ // if it is possible to shift timeblocks up; should never fail this condition but might as well test
                        return shiftTimeblocks(-1, start - 2, cachedOldTimeblocks, -shiftAmt)
                    }
                    else{
                        alert("Making room for this timeblock would cause the last timeblock to spill into the next day; aborting")
                        return []
                    }
                }
                else{
                    // update times then push
                    oldTimeblocks[currentTBIndex].startTime = addMinutesToTimeString(oldTimeblocks[currentTBIndex].startTime, shiftAmt)
                    oldTimeblocks[currentTBIndex].endTime = addMinutesToTimeString(oldTimeblocks[currentTBIndex].endTime, shiftAmt)
                    newTimeblocks.push(oldTimeblocks[currentTBIndex])
                    currentTBIndex += 1 // so we dont push the original, untouched copy to newTimeblocks after breaking 
                }
                break
            }

            // update times then push
            oldTimeblocks[currentTBIndex].startTime = addMinutesToTimeString(oldTimeblocks[currentTBIndex].startTime, shiftAmt)
            oldTimeblocks[currentTBIndex].endTime = addMinutesToTimeString(oldTimeblocks[currentTBIndex].endTime, shiftAmt)
            newTimeblocks.push(oldTimeblocks[currentTBIndex])
            currentTBIndex += 1

        } while(getMinuteDifference(newTimeblocks[currentTBIndex - 1].endTime, oldTimeblocks[currentTBIndex].startTime) < 0)

        // adding the remaining untouched timeblocks to newTimeblocks
        for (i = currentTBIndex; i < oldTimeblocks.length; i++){
            newTimeblocks.push(oldTimeblocks[i])
        }

        return newTimeblocks
    }
    else if (start == -1){ // start shifting up at oldTimeblocks[end] and break once there is no overlap

        let newTimeblocks = []

        // shifting timeblocks and appending them to newTimeblocks
        let currentTBIndex = end
        do {
            // update times then push
            oldTimeblocks[currentTBIndex].startTime = addMinutesToTimeString(oldTimeblocks[currentTBIndex].startTime, shiftAmt)
            oldTimeblocks[currentTBIndex].endTime = addMinutesToTimeString(oldTimeblocks[currentTBIndex].endTime, shiftAmt)
            newTimeblocks.push(oldTimeblocks[currentTBIndex])
            currentTBIndex -= 1

            // if we're about to shift the earliest timeblock
            if (currentTBIndex == 0){

                // if shifting the last timeblock would cause it to spill over into the next day
                if (getTimeStringStartingHour(oldTimeblocks[0].startTime) == "12:00 AM"
                        && (getMinutesOfTimeString(oldTimeblocks[0].startTime) < -shiftAmt)){

                    alert("Making room for this timeblock would cause the first timeblock to spill into the previous day; aborting")
                    return []
                }
                else{
                    // update times then push
                    oldTimeblocks[0].startTime = addMinutesToTimeString(oldTimeblocks[0].startTime, -shiftAmt)
                    oldTimeblocks[0].endTime = addMinutesToTimeString(oldTimeblocks[0].endTime, -shiftAmt)
                    newTimeblocks.push(oldTimeblocks[0])
                    currentTBIndex -= 1 // so we dont push the original, untouched copy to newTimeblocks after breaking
                }
                break
            }
            
        } while(getMinuteDifference(oldTimeblocks[currentTBIndex].endTime, oldTimeblocks[currentTBIndex + 1].startTime) < 0)

        // since we pushed timeblocks backwards
        newTimeblocks.reverse()

        // prepending the earliest untouched timeblocks to newTimeblocks
        let i;
        for (i = currentTBIndex; i >= 0; i--){
            newTimeblocks.insert(0, oldTimeblocks[i])
        }

        // appending the untouched timeblocks after 'end' to newTimeblocks
        for (i = end + 1; i < oldTimeblocks.length; i++){
            newTimeblocks.insert(i, oldTimeblocks[i])
        }

        return newTimeblocks
    }
    else{ // normal shifting in the range(start, end) with 'end' being noninclusive
        
        for (let i=start; i < end; i++){
            oldTimeblocks[i].startTime = addMinutesToTimeString(oldTimeblocks[i].startTime, shiftAmt)
            oldTimeblocks[i].endTime = addMinutesToTimeString(oldTimeblocks[i].endTime, shiftAmt)
        }

        return oldTimeblocks
    }
}

// compute new timeblock data after drag and drop
export const getPostDragAndDropData = (dropzoneIndex, onUpperTB, onLowerTB, dropzoneProportion, droppedTBIndex, userDraggedUp, oldTimeblocks) => {
    
    let droppedTimeblock = oldTimeblocks[droppedTBIndex]
    let newStartTime;
    let newEndTime;
    let shiftData;

    if (userDraggedUp){
        if (dropzoneIndex == 0){ // dropzone above earliest timeblock

            // place middle of timeblock where the user released their touch
            const firstTimeblockStartTimeColonIndex = oldTimeblocks[0].startTime.indexOf(":")
            const firstTimeblockMinutesFromHour = parseInt(oldTimeblocks[0].startTime.substring(
                firstTimeblockStartTimeColonIndex + 1,
                firstTimeblockStartTimeColonIndex + 3
            ))
            const firstTimeblockAMorPM = oldTimeblocks[0].startTime.substring(firstTimeblockStartTimeColonIndex + 4)

            // if release was too low for the whole timeblock to fit, make the endTime of the timeblock the startTime of tb[0]
            // also do this if onLowerTB is true (user dropped this TB on top of timeblock 0)
            let notEnoughRoom = Math.ceil(droppedTimeblock.minutes / 2) + 4 >= Math.ceil(firstTimeblockMinutesFromHour * dropzoneProportion)
            if (notEnoughRoom || onLowerTB){

                newEndTime = oldTimeblocks[0].startTime
                newStartTime = addMinutesToTimeString(newEndTime, -(droppedTimeblock.minutes))
            }
            else{ // if placing the midpoint of the timeblock at the touch release point will leave some room below the timeblock

                // startTimeMin will be the proportion of dropzone covered times the size of the dropzone in minutes -> rounded down to a 5
                let endTimeMinutes = Math.floor(dropzoneProportion * firstTimeblockMinutesFromHour + droppedTimeblock.minutes / 2)
                endTimeMinutes = endTimeMinutes - (endTimeMinutes % 5)

                // new endTime = tb[0] hour + ":" + endTimeMin + firstTimeblockAMorPM
                newEndTime = oldTimeblocks[0].startTime.substring(0, firstTimeblockStartTimeColonIndex + 1)
                if (endTimeMinutes < 10){
                    newEndTime += "0"
                }
                newEndTime += endTimeMinutes.toString()
                newEndTime += ` ${firstTimeblockAMorPM}`

                newStartTime = addMinutesToTimeString(newEndTime, -droppedTimeblock.minutes)
            }
        }
        else{ // dropped timeblock above oldTimeblocks[dropzoneIndex] and below oldTimeblocks[dropzoneIndex - 1]
            
            // get available minutes in the dropzone relative to the dropped timeblock's size 
            const space = getMinuteDifference(
                oldTimeblocks[dropzoneIndex - 1].endTime,
                oldTimeblocks[dropzoneIndex].startTime
            )
            const extraSpace = space - droppedTimeblock.minutes

            // amount of space covered by dropzoneProportion in minutes
            const spaceCovered = Math.ceil(space * dropzoneProportion)

            // first branch to set newStartTime = upper TB endTime, second to set newEndTime = lower TB startTime, third to set new times according to dropzoneProportion cause there's enough space
            // the +4 in the third part of this first condition ensures that rounding down to the nearest 5 wont cause overlap
            if ((extraSpace <= 0) || onUpperTB || (Math.ceil(spaceCovered + droppedTimeblock.minutes / 2) + 4) > space){

                newStartTime = oldTimeblocks[dropzoneIndex - 1].endTime
                newEndTime = addMinutesToTimeString(newStartTime, droppedTimeblock.minutes)

                if (extraSpace < 0){
                    // shift each intermediate timeblock by |extraSpace| rounded up to a 5 (which is in minutes)
                    const shiftAmt = Math.abs(extraSpace) + (5 - (Math.abs(extraSpace) % 5 > 0 ? Math.abs(extraSpace) % 5 : 5))
                    shiftData = {
                        range: {
                            start: dropzoneIndex, 
                            end: droppedTBIndex
                        },
                        shiftAmt: shiftAmt
                    }
                }
            }
            else if (onLowerTB || Math.floor(spaceCovered - droppedTimeblock.minutes / 2) < 0){

                newEndTime = oldTimeblocks[dropzoneIndex].startTime
                newStartTime = addMinutesToTimeString(newEndTime, -droppedTimeblock.minutes)
            }
            else{ // there is enough space to place the center of the timeblock right where the user released their touch

                // rounding the new startTime's distance in minutes from the dropzone timeblock's startTime down to the nearest 5
                let minsFromDropzoneTimeblockStartTime = Math.ceil(spaceCovered + droppedTimeblock.minutes / 2)
                minsFromDropzoneTimeblockStartTime = minsFromDropzoneTimeblockStartTime - (minsFromDropzoneTimeblockStartTime % 5)

                newStartTime = addMinutesToTimeString(
                    oldTimeblocks[dropzoneIndex].startTime,
                    -minsFromDropzoneTimeblockStartTime
                )
                newEndTime = addMinutesToTimeString(
                    newStartTime,
                    droppedTimeblock.minutes
                )
            }
        }
    }
    else { // !userDraggedUp
        if (dropzoneIndex == oldTimeblocks.length - 1){ // dropzone below latest timeblock
            
            const spaceCovered =  dropzoneProportion * 50 // bottom dropzone is 100px so 50 minutes
            
            if (onUpperTB || (Math.floor(spaceCovered - droppedTimeblock.minutes / 2) - 4 < 0)){ // set new startTime to endTime of last timeblock

                newStartTime = oldTimeblocks[dropzoneIndex].endTime
                newEndTime = addMinutesToTimeString(newStartTime, droppedTimeblock.minutes)
            }
            else{ // place middle of timeblock where the user dropped it

                // rounding the new startTime's distance in minutes from the dropzone timeblock's startTime down to the nearest 5
                let minsFromDropzoneTimeblockEndTime = Math.ceil(spaceCovered - droppedTimeblock.minutes / 2)
                minsFromDropzoneTimeblockEndTime = minsFromDropzoneTimeblockEndTime - (minsFromDropzoneTimeblockEndTime % 5)

                newStartTime = addMinutesToTimeString(
                    oldTimeblocks[dropzoneIndex].endTime,
                    minsFromDropzoneTimeblockEndTime
                )
                newEndTime = addMinutesToTimeString(
                    newStartTime,
                    droppedTimeblock.minutes
                )
            }
        }
        else{ // dropped timeblock below oldTimeblocks[dropzoneIndex] and above oldTimeblocks[dropzoneIndex + 1]
            
            // get available minutes in the dropzone relative to the dropped timeblock's size 
            const space = getMinuteDifference(
                oldTimeblocks[dropzoneIndex].endTime,
                oldTimeblocks[dropzoneIndex + 1].startTime
            )
            const extraSpace = space - droppedTimeblock.minutes

            // amount of space covered by dropzoneProportion in minutes
            const spaceCovered = Math.ceil(space * dropzoneProportion)

            // first branch to set newEndTime = lower TB startTime, second to set newStartTime = upper TB endTime, third to set new times according to dropzoneProportion cause there's enough space
            // the +4 in the third part of this first condition ensures that rounding down to the nearest 5 wont cause overlap
            if ((extraSpace <= 0) || onLowerTB || (Math.ceil(spaceCovered + droppedTimeblock.minutes / 2) + 4) > space){

                newEndTime = oldTimeblocks[dropzoneIndex + 1].startTime
                newStartTime = addMinutesToTimeString(newEndTime, -droppedTimeblock.minutes)

                if (extraSpace < 0){
                    // shift each intermediate timeblock by extraSpace rounded down to a 5 (which is in minutes)
                    // extraSpace is negative and we want to keep it that way (ex: extraSpace = -31 -> shiftAmt = -35)
                    const shiftAmt = extraSpace - (5 - (Math.abs(extraSpace) % 5 > 0 ? Math.abs(extraSpace) % 5 : 5))
                    shiftData = {
                        range: {
                            start: droppedTBIndex + 1,
                            end: dropzoneIndex + 1
                        },
                        shiftAmt: shiftAmt
                    }
                }
            }
            else if (onUpperTB || Math.floor(spaceCovered - droppedTimeblock.minutes / 2) < 0){

                newStartTime = oldTimeblocks[dropzoneIndex].endTime
                newEndTime = addMinutesToTimeString(newStartTime, droppedTimeblock.minutes)
            }
            else{ // there is enough space to place the center of the timeblock right where the user released their touch

                // rounding the new startTime's distance in minutes from the dropzone timeblock's startTime down to the nearest 5
                let minsFromDropzoneTimeblockEndTime = Math.floor(spaceCovered - droppedTimeblock.minutes / 2)
                minsFromDropzoneTimeblockEndTime = minsFromDropzoneTimeblockEndTime - (minsFromDropzoneTimeblockEndTime % 5)

                newStartTime = addMinutesToTimeString(
                    oldTimeblocks[dropzoneIndex].endTime,
                    minsFromDropzoneTimeblockEndTime
                )
                newEndTime = addMinutesToTimeString(
                    newStartTime,
                    droppedTimeblock.minutes
                )
            }
        }
    }

    return {
        newStartTime: newStartTime,
        newEndTime: newEndTime,
        shiftData: shiftData
    }
}


// find a valid dropzone which means translationY > minY[i] & translationY < lowerY[i]
// returns the dropzone's associated timeblock's index in mainState.timeblocks of TimeblockScreen
export const getDropzone = (translationY, longPressYCoord, dropzoneData) => {

    translationY += longPressYCoord // subtract yCoord of longPress which is relative to the top of the timeblock

    // find a valid dropzone which means translationY > minY[i] & translationY < maxY[i]
    for (i of range(dropzoneData.length)){
        if (translationY > dropzoneData[i].minY && translationY < dropzoneData[i].maxY){

            // if the user dropped the timeblock on top of the minY timeblock or maxY timeblock
            const onUpperTB = translationY < dropzoneData[i].upperTBEnd
            const onLowerTB = translationY > dropzoneData[i].lowerTBEnd

            // getting the proportion of the dropzone (only including inter-timeblock whitespace) that the user crossed with their touch
            let dropzoneProportion;
            if (onUpperTB || onLowerTB){
                dropzoneProportion = 0
            }
            else if (translationY < 0){ // user dragged up; if translationY == (top of the lower timeblock), proportion = 0
                if (dropzoneData[i].timeblockIndex == 0){
                    dropzoneProportion = (dropzoneData[i].lowerTBEnd - translationY) / (dropzoneData[i].lowerTBEnd - dropzoneData[i].minY)
                }
                else{
                    dropzoneProportion = (dropzoneData[i].lowerTBEnd - translationY) / (dropzoneData[i].lowerTBEnd - dropzoneData[i].upperTBEnd)
                }
            }
            else{ // user dragged down; if translationY == (bottom of the upper timeblock), proportion = 0
                if (i == dropzoneData.length - 1){
                    dropzoneProportion = (translationY - dropzoneData[i].upperTBEnd) / (dropzoneData[i].maxY - dropzoneData[i].upperTBEnd)
                    dropzoneProportion += .2 // the translationY range goes off the screen a lil bit
                }
                else{
                    dropzoneProportion = (translationY - dropzoneData[i].upperTBEnd) / (dropzoneData[i].lowerTBEnd - dropzoneData[i].upperTBEnd)
                }
            }

            return {
                dropzoneIndex: dropzoneData[i].timeblockIndex,
                onUpperTB: onUpperTB,
                onLowerTB: onLowerTB,
                dropzoneProportion: dropzoneProportion
            }
        }
    }
    return {dropzoneIndex: -1}
}

/*
    This function gets valid drag and drop pixel ranges (in units of translationY of PanGestureHandler's nativeEvent) for a single timeblock (thisTB)
    of the form [
        {
            timeblockIndex: this dropzone's associated timeblock,
            minY: minimum translationY + longPressYCoord (longPressYCoord is the Y coordinate of the longPress that 
                initiated drag and drop and will be subtracted upon drag and drop completion)
            upperTBEnd: the point at which the upper timeblock ends
            maxY: maximum translationY + longPressYCoord
            lowerTBEnd: the point at which the lower timeblock ends
        },
        ...
    ]

    minY and maxY will be negative for dropzones above thisTB and positive if below (bc of how translationY works)

    timeblockIndex will match the timeblock's order in TimeblockScreen's mainState and will streamline TimeblockScreen's computation
    of the new timeblocks state variable

    Structure of layoutData: [
        {
            id: timeblockID, 
            yOffset: yCoord of top of timeblock relative to top of ScrollView, 
            height: height of timeblock in px
        }, 
        ...
    ]

    Final product (same as above but full object):
        {
            thisTBIndex: index of thisTB in the layoutData array and timeblocks mainState variable in TimeblockScreen,
            dropzones: [
                {
                    timeblockIndex: this dropzone's associated timeblock,
                    minY: minimum translationY + longPressYCoord (longPressYCoord is the Y coordinate of the longPress that 
                        initiated drag and drop and will be subtracted upon drag and drop completion)
                    upperTBEnd: the point at which the upper timeblock ends
                    maxY: maximum translationY + longPressYCoord
                    lowerTBEnd: the point at which the lower timeblock ends
                },
                ...
            ]
        }

    NOTE: "this" timeblock refers to the timeblock we are calculating dropzones for
*/
export const getDragAndDropData = (layoutData, numTimeblocks, thisTBID) => {

    // not all layoutData has registered
    if (numTimeblocks > layoutData.length){ return [] }

    let dropzoneData = {
        thisTBIndex: -1,
        dropzones: []
    }

    // get thisTB's layoutData and index in the mainState.timeblocks array
    let thisTBLayoutData;
    for (i of range(layoutData.length)){
        if (layoutData[i].id == thisTBID){
            thisTBLayoutData = layoutData[i]
            dropzoneData.thisTBIndex = i
            break
        }
    }
    if (dropzoneData.thisTBIndex == -1){ throw new Error("Didnt find thisTB in layoutData in getDragAndDropData") }

    // append timeblock's dropzone data to dropzoneData.dropzone
    let passedThisTB = false;
    for (i of range(layoutData.length)){

        if (layoutData[i].id == thisTBID){
            passedThisTB = true
            continue
        }

        // if layoutData[i] represents the first timeblock
        if (i == 0){
            const minY = -(thisTBLayoutData.yOffset) - 60
            const lowerTBEnd = -(thisTBLayoutData.yOffset - layoutData[0].yOffset)

            dropzoneData.dropzones.push({
                timeblockIndex: 0,
                minY: minY,
                maxY: lowerTBEnd + .5 * layoutData[0].heightPx,
                lowerTBEnd: lowerTBEnd
            })
            continue
        }

        // if layoutData[i] represents the last timeblock
        if (i == layoutData.length - 1){
            const upperTBEnd = layoutData[i].yOffset - thisTBLayoutData.yOffset + layoutData[i].heightPx
            const maxY = upperTBEnd + 100

            dropzoneData.dropzones.push({
                timeblockIndex: i,
                minY: upperTBEnd - .5 * layoutData[i].heightPx,
                upperTBEnd: upperTBEnd,
                maxY: maxY
            })
            continue
        }

        let upperTBEnd;
        let lowerTBEnd;
        let minY;
        let maxY;
        if (!passedThisTB){ // if layoutData[i]'s timeblock is before thisTB
            upperTBEnd = layoutData[i-1].yOffset - thisTBLayoutData.yOffset + layoutData[i-1].heightPx
            minY = upperTBEnd - .5 * layoutData[i-1].heightPx
            lowerTBEnd = layoutData[i].yOffset - thisTBLayoutData.yOffset
            maxY = lowerTBEnd + .5 * layoutData[i].heightPx
        }
        else{ // layoudData[i]'s timeblock is after thisTB
            upperTBEnd = layoutData[i].yOffset - thisTBLayoutData.yOffset + layoutData[i].heightPx 
            minY = upperTBEnd - .5 * layoutData[i].heightPx 
            lowerTBEnd = layoutData[i+1].yOffset - thisTBLayoutData.yOffset
            maxY = lowerTBEnd + .5 * layoutData[i+1].heightPx
        }

        dropzoneData.dropzones.push({
            timeblockIndex: i,
            minY: minY,
            upperTBEnd: upperTBEnd,
            maxY: maxY,
            lowerTBEnd: lowerTBEnd
        })
    }

    return dropzoneData
}

// timeString (ex: 6:15 PM) -> timeString with negative or positive amount of minutes added
export const addMinutesToTimeString = (timeString, minutes) => {

    // convert to Date object -> add minutes in ms & convert back to timeString in return statement
    let dateObj = timeStringToDateObj(timeString)
    const difference = minutes * 60 * 1000

    return dateObjToTimeString(new Date(dateObj.getTime() + difference))
}


// timeString (ex: "6:15 PM") -> date object containing this time
export const timeStringToDateObj = (timeString) => {

    // user has not yet clicked on a timeblock for editing
    if (!timeString){
        return new Date()
    }

    // if the timeString's hour is in the single digits
    if (timeString.length == 6){
        timeString = '0' + timeString
    }

    return new Date(getMinuteDifference("12:00 AM", timeString) * 60 * 1000 + 360 * 60 * 1000) // minutes from 12 AM in ms + 6 hours for some rzn
}


// callback for the Submit btn on the TimeblockModal; validate data -> store TimeblockModal-relevant data if necessary -> send modalState to TimeblockScreen
export const onSubmitTimeblockModal = (modalProps, modalState, existingData, setModalVisibility, setModalCategoryColor, setNewDataFlag) => {
    
    // validate time input
    if (!validateNewTimes(modalProps.timeblocks, modalState.currentStartTime, modalState.currentEndTime, modalProps.timeblockID)){
        alert("Entered times overlap existing timeblocks or are out of order")
        return
    }

    // set possibleNewOrderFlag if the new startTime is earlier than before or the new endTime is later than before
    let possibleNewOrderFlag = false;
    if ((getMinuteDifference(modalProps.startTime, modalState.currentStartTime) < 0) || (getMinuteDifference(modalProps.endTime, modalState.currentEndTime) > 0)){
        possibleNewOrderFlag = true
    }

    // check if user created new data; if so, we will set newDataFlag to true after storing the new data
    const newCategory = modalState.currentCategory && !existingData.categoryNames.includes(modalState.currentCategory) && !(modalState.currentCategory.trim().length == 0)
    const newTaskName = modalState.currentTaskName && !existingData.taskNames.find(taskObj => taskObj.name == modalState.currentTaskName) && !(modalState.currentTaskName.trim().length == 0)

    // storing new data and notifying the modal so it gets the new data for next time
    if (newCategory && modalState.currentCategory){

        // store the new category; this will automatically update categories
        console.log("New cat")
        storeNewCategory(modalState.currentCategory, modalState.currentColor, existingData.categories, null)

        // store new task name if necessary
        if (newTaskName && modalState.currentTaskName){
            console.log("New task")
            storeNewTaskName(modalState.currentTaskName, existingData.taskNames, null)
        }

        setNewDataFlag(true)
    }
    else if (newTaskName && modalState.currentTaskName){

        // store the new task name
        console.log("New task")
        storeNewTaskName(modalState.currentTaskName, existingData.taskNames)

        setNewDataFlag(true)
    }   
    
    modalProps.sendData(
        modalProps.timeblockID, 
        modalState.currentTaskName, 
        modalState.currentStartTime, 
        modalState.currentEndTime, 
        modalState.currentCategory, 
        possibleNewOrderFlag
    )

    // close the modal and reset color display
    setModalVisibility(false)
    setModalCategoryColor(undefined)
}


// DateHeader left/right arrow onPress logic; only changes the date by one day for now
export const changeDate = (changeAmt, currentDateObj, navigation) => {

    // calculate new date
    const difference = 86400000 * changeAmt; /* 86400000 is 24 hrs in ms*/

    // getNewDatetimeParam will properly format the new date
    let newDatetimeParam = getNewDatetimeParam(new Date(currentDateObj.getTime() + difference)) // ex: May 20 2021

    // set datetime param so useEffect triggers page update with proper timeblocks
    navigation.setParams({
        datetime: newDatetimeParam,
        manual: true
    });
}

/**
 * 
 * This method will update state and the database after a single timeblock has been altered
 * 
 * @param {Array} oldOrderedTimeblockIDs
 * @param {Array} newTimeblocks // array of timeblocks including the updated timeblock
 * @param {number} updatedTimeblockID // the id of the timeblock that had its contents updated 
 * @param {string} updatedTimeblockStartTime
 * @param {string} dateObject // for updating the database
 * @param {Function} mainDispatch // for setting TimeblockScreen state
 */
export const updateOneTimeblock = async (oldOrderedTimeblockIDs, newTimeblocks, updatedTimeblockID, updatedTimeblockStartTime, possibleNewOrder, dateObject, mainDispatch) => {

    if (possibleNewOrder){
        /* set insertionIndex to:
        *       -1 if we never came across a timeblock that starts after the updatedTimeblock
        *       -2 if the updated timeblock's id is already in the correct position
        *       The proper position (index) of the updated timeblock's id
        */
        let insertionIndex = -1;
        for (i of range(newTimeblocks.length)){
            // skip the timeblock we're operating on
            if (oldOrderedTimeblockIDs[i] == updatedTimeblockID){
                continue;
            }

            // if getMinuteDifference returns a positive value, we reached a timeblock that is after the timeblock we're operating on
            let currentTimeblockStartTime = newTimeblocks.find(tb => tb.id == oldOrderedTimeblockIDs[i]).startTime;
            let currentTimeblockIsAfterNewStartTime = getMinuteDifference(updatedTimeblockStartTime, currentTimeblockStartTime) > 0;
            if (currentTimeblockIsAfterNewStartTime && (oldOrderedTimeblockIDs[i-1] != updatedTimeblockID)){
                insertionIndex = i;
                break;
            }
            else if (currentTimeblockIsAfterNewStartTime){
                insertionIndex = -2; // the id is already in the correct position
                break;
            }
        }

        // moving this timeblock's id to the proper place and update database if the insertionIndex was set -> set state
        if (insertionIndex == -1){ // if the new time gives this timeblock the latest startTime
            let newOrderedTimeblockIDs = [...oldOrderedTimeblockIDs]
            newOrderedTimeblockIDs.removeOnce(id);
            newOrderedTimeblockIDs.push(id);

            // updating the timeblocks and orderedTimeblockIDs in the DB
            const dateString = dateObject.toDateString().replaceAll(" ", "_").substring(4); 
            updateOrderedTimeblockIDsInDB(newOrderedTimeblockIDs, dateString)
            updateTimeblocksInDB(newTimeblocks, dateString)

            // rerender component (necessary for Timeblock and TimeblockNumber spacing)
            mainDispatch({
                type: 'set timeblocks + order', 
                payload: {
                    timeblocks: newTimeblocks,
                    orderedTimeblockIDs: newOrderedTimeblockIDs
                }
            })
        }
        else if (insertionIndex == -2){ // if the new time does not warrant a new timeblock order
            // rerender component (necessary for Timeblock and TimeblockNumber spacing)

            // updating timeblocks in the DB; leaving orderedTimeblockIDs alone
            const dateString = dateObject.toDateString().replaceAll(" ", "_").substring(4);
            updateTimeblocksInDB(newTimeblocks, dateString)

            mainDispatch({
                type: 'set timeblocks + order', 
                payload: {
                    timeblocks: newTimeblocks,
                    orderedTimeblockIDs: oldOrderedTimeblockIDs
                }
            })
        }
        else { // if the new time warrants a change in the order of the timeblocks
            let newOrderedTimeblockIDs = [...oldOrderedTimeblockIDs]
            newOrderedTimeblockIDs.removeOnce(id);
            newOrderedTimeblockIDs.insert(insertionIndex, id);

            // updating the timeblocks and orderedTimeblockIDs in the DB
            const dateString = dateObject.toDateString().replaceAll(" ", "_").substring(4); 
            updateOrderedTimeblockIDsInDB(newOrderedTimeblockIDs, dateString)
            updateTimeblocksInDB(newTimeblocks, dateString)

            // rerender component (necessary for Timeblock and TimeblockNumber spacing)
            mainDispatch({
                type: 'set timeblocks + order', 
                payload: {
                    timeblocks: newTimeblocks,
                    orderedTimeblockIDs: newOrderedTimeblockIDs
                }
            })
        }
    }
    else{ // not possible for the new times to warrant a new timeblock order

        // set state and update database
        const dateString = dateObject.toDateString().replaceAll(" ", "_").substring(4);
        updateTimeblocksInDB(newTimeblocks, dateString)

        mainDispatch({
            type: "set timeblocks",
            payload: {
                timeblocks: newTimeblocks
            }
        })
    }
}

// format dateObject into a string that we can update route.params with
export const getNewDatetimeParam = (dateObject) => {
    let newDatetimeParam = dateObject.toDateString().substring(4) // ex: May 20 2021
    newDatetimeParam = newDatetimeParam.split(" ") // ex: ['May', '20', '2021']
    newDatetimeParam[0] = getMonthNumber(newDatetimeParam[0]); // ex: 'May' -> '5'
    if (newDatetimeParam[0].length == 1){
        newDatetimeParam[0] = '0' + newDatetimeParam[0];
    }
    newDatetimeParam = `${newDatetimeParam[2]}-${newDatetimeParam[0]}-${newDatetimeParam[1]}`

    return newDatetimeParam;
}

// update a timeblock and return the new list of timeblocks
export const updateOneTimeblockInArray = (oldTimeblocks, id, newTaskName, newStartTime, newEndTime, newCategory) => {
    return oldTimeblocks.map(timeblock => {
        if (timeblock.id == id){

            const newMinutes = getMinuteDifference(newStartTime, newEndTime);

            timeblock.taskName = newTaskName;
            timeblock.startTime = newStartTime;
            timeblock.endTime = newEndTime;
            timeblock.minutes = newMinutes;
            timeblock.overlap = getTimeblockOverlap(newStartTime, newMinutes);
            timeblock.category = newCategory;
        }
        return timeblock;
    })
}

// validate that new timeblock times dont overlap any timeblocks or contain an endTime before a startTime
export const validateNewTimes = (timeblocks, newStartTime, newEndTime, timeblockID) => {
    
    for (timeblock of timeblocks){
        // skipping the timeblock being validated
        if (timeblock.id == timeblockID){
            continue
        }

        const minuteDiff = getMinuteDifference(newStartTime, timeblock.startTime);
        const newTimesMinutes = getMinuteDifference(newStartTime, newEndTime);
        
        if (newTimesMinutes <= 0){
            return 0
        }

        // evaluating the comparison by the order of 'timeblock' and the edited timeblock
        if (minuteDiff < 0){
            if (Math.abs(minuteDiff) < timeblock.minutes){
                return 0
            }
        }
        else if (minuteDiff > 0){
            if (minuteDiff < newTimesMinutes){
                return 0
            }
        }
        else{
            return 0
        }
    }

    return 1
}

// timeblocks -> list of tuples of the form [index in mainState.timeblocks, offset from above timeblock]
export const getTimeblockTuples = (timeblocks) => {

    if (!timeblocks || timeblocks.length == 0){
        return [];
    }

    let timeblockTuples = [];
    
    // appending first timeblock's data to the list; its offset will just be its minutes
    const firstTBStartTimeColonIndex = timeblocks[0].startTime.indexOf(':');
    timeblockTuples.push(
        [
            0,
            // its startTime's minutes
            parseInt(timeblocks[0].startTime.substring(firstTBStartTimeColonIndex + 1, firstTBStartTimeColonIndex + 3)),
        ]
    );

    let previousTBEndTime = timeblocks[0].endTime;
    for (let i = 1; i < timeblocks.length; i++){
        timeblockTuples.push(
            [
                i,
                getMinuteDifference(previousTBEndTime, timeblocks[i].startTime),
            ]
        );

        previousTBEndTime = timeblocks[i].endTime;
    }

    return timeblockTuples;
}

// timeblocks -> set of hours (ex: "12 PM") that are in the timeblock start or end times
export const getTimeblockHours = (timeblocks) => {

    if (!timeblocks || timeblocks.length == 0){
        return [];
    }

    // getting a list of the hours ("[1-12] [AM|PM]") that are present in the timeblock data
    let numbers = new Set();
    timeblocks.forEach(timeblock => {
        // parsing hour and AM/PM from timeblock startTime and endTime
        const timeblockStartColonIndex = timeblock.startTime.indexOf(":");
        const timeblockStartHour = timeblock.startTime.substring(0, timeblockStartColonIndex);
        const timeblockStartAMorPM = timeblock.startTime.substring(timeblockStartColonIndex + 4);

        const timeblockEndColonIndex = timeblock.endTime.indexOf(":");
        const timeblockEndHour = timeblock.endTime.substring(0, timeblockEndColonIndex);
        const timeblockEndAMorPM = timeblock.endTime.substring(timeblockEndColonIndex + 4);

        numbers = numbers.add(`${timeblockStartHour} ${timeblockStartAMorPM}`);
        numbers = numbers.add(`${timeblockEndHour} ${timeblockEndAMorPM}`);
    });

    return numbers;
}

// Getting the proportion of the timeblock exists outside of the hour it starts in
export const getTimeblockOverlap = (startTime, minutes) => {

    // minutes from the hour of the timeblock's startTime
    const startMinute = getMinutesOfTimeString(startTime)

    // since we only use this function on timeblocks of length less than 30
    if (minutes >= 30){
      return null;
    }
    else if (startMinute <= 60 - minutes){
        return 0
    }

    return 1 - ((60 - startMinute) / minutes);
} 


// getMinuteDifference: "0?[1-12]:[0-5][0-9] [AM|PM]", "0?[1-12]:[0-5][0-9] [AM|PM]" --> difference in minutes
// This method assumes that the 24 hour "day" is anchored by the first timeblock's start time and that time1 and time2 are in order
export const getMinuteDifference = (time1, time2) => {

    // partitioning the times
    const time1_colon_index = time1.indexOf(':');
    const time1_hour = parseInt(time1.substring(0, time1_colon_index));
    const time1_minutes = parseInt(time1.substring(time1_colon_index + 1, time1_colon_index + 3));
    const time1_AMorPM = time1.substring(time1_colon_index + 4);

    const time2_colon_index = time2.indexOf(':');
    const time2_hour = parseInt(time2.substring(0, time2_colon_index));
    const time2_minutes = parseInt(time2.substring(time2_colon_index + 1, time2_colon_index + 3));
    const time2_AMorPM = time2.substring(time2_colon_index + 4);


    // probably will need this when we give users the ability to set the startTime of the day
    // gonna need to associate days with startTimes after that too

    /* // flagging the need to add 24 hrs to time2 if there is a big enough difference between time1 and time2
    let add_24hrs = 0;  
    // dont add 24 hrs of minutes if this flag is set
    if (add_24hrs_flag){
        if (time1_AMorPM == time2_AMorPM){
            if (time2_hour < time1_hour && time1_hour != 12){
                add_24hrs = 1;
            }
            else if (time1_hour == 12 && time2_hour == 12 && time2_minutes < time1_minutes){
                add_24hrs = 1;
            }
            else if (time2_hour == 12 && time1_hour != 12){
                add_24hrs = 1;
            }
        }
        else if (time1_AMorPM == "PM" && time2_AMorPM == "AM"){
            add_24hrs = 1;
        }
    } */

    // convert both times to minutes, adding 24 hours to time2 if necessary
    const time1_total_minutes = getMinutes(time1_hour, time1_minutes, time1_AMorPM);
    const time2_total_minutes = getMinutes(time2_hour, time2_minutes, time2_AMorPM) // + 60 * 24 * add_24hrs;

    // subtract and return
    return time2_total_minutes - time1_total_minutes;
}


// getMinutes: "0?[1-12]:[0-5][0-9] [AM|PM]" --> minutes apart from 12 AM
export const getMinutes = (hours, minutes, AMorPM) => {

    if (AMorPM == "AM"){
        if (hours == 12){
            return minutes;
        }
        return hours * 60 + minutes;
    }
    else{
        if (hours == 12){
            return 12 * 60 + minutes;
        }
        return (12 + hours) * 60 + minutes;
    }
}

// using the list of TimeblockNumbers we need to render and the 'timeblocks' state variable, return list of 3-tuples of the form [hour, marginBottom, id]
export const getTimeblockNumberTuples = (numbers, timeblocks) => {
    
    if (!timeblocks || timeblocks.length == 0){
        return [];
    }
    
    /**
    * The meat of this computation is accounting for timeblocks below 10 minutes since they are all the same height and therefore
    * require extra space to keep the numbers' spacing to scale
    */

    let numberTuples = [];
    let currentID; // this id is necessary for the map function during rendering 
    for (currentID=1; currentID<=numbers.length; currentID++) {
        numberTuples.push([numbers[currentID - 1], 36, currentID])
    };

    // adding extra height for smol timeblocks; need to take overlap into account here
    timeblocks.forEach(timeblock => {
        if (timeblock.minutes < 30){
        
            // getting the timeblock's starting hour of the form "4 AM"
            const timeblockStartingHour = timeblock.startTime.substring(0, timeblock.startTime.indexOf(":"))
            const timeblockAMorPM = timeblock.startTime.substring(timeblock.startTime.indexOf(":") + 4)

            // computing extra TimeblockNumber marginBottom
            const extraHeight = 30 - timeblock.minutes;
            let nextHourIndex;
            for (const numberTuple of numberTuples){
                if (numberTuple[0] == `${timeblockStartingHour} ${timeblockAMorPM}`){
                    numberTuple[1] += extraHeight * (1 - timeblock.overlap);

                    if (timeblock.overlap > 0){
                        nextHourIndex = numberTuples.indexOf(numberTuple) + 1;
                    }

                    break;
                }
            };

            // adding pixels to the next hour in case there's overlap
            if (timeblock.overlap > 0){
                numberTuples[nextHourIndex][1] += extraHeight * timeblock.overlap;
            }
        }
    });

    return numberTuples;
}

// add intermediate hours to an array of hours (ex: ["12 PM", "2 PM", "4 PM"] -> ["12 PM", "1 PM", "2 PM", "3 PM", "4 PM"])
export const addIntermediateHours = (hours) => {
    
    const originalNumbers = [...hours]; // caching the original numbers array
    for (const i of range(originalNumbers.length)){

        // if we've completed the process
        if (i == originalNumbers.length - 1){
            break;
        }

        // current and next hour in the array
        const currentHour = originalNumbers[i];
        const nextHour = originalNumbers[i+1];

        // returns array of strings of the form "[1-12] [AM|PM]" to be inserted after currentHour
        const newNumbers = getIntermediateHours(currentHour, nextHour);

        // inserting the intermediate hours after currentHour
        let insertionCount = 1;
        newNumbers.forEach(newNumber => {
            hours.insert(hours.indexOf(currentHour) + insertionCount, newNumber);
            insertionCount += 1;
        });
    }

    return hours
}

/**
 * getIntermediateHours: ("[1-12] [AM|PM]", "[1-12] [AM|PM]") --> list of intermediate hours in the same string format
 * 
 * This is definitely ugly but negligible runtime soooooo
 */
export const getIntermediateHours = (hr1, hr2) => {

    // parsing the params for their hour's number and AM or PM
    hr1_number = parseInt(hr1.substring(0, hr1.indexOf(" ")));
    hr1_AMorPM = hr1.substring(hr1.indexOf(' ') + 1);

    hr2_number = parseInt(hr2.substring(0, hr2.indexOf(" ")));
    hr2_AMorPM = hr2.substring(hr2.indexOf(' ') + 1);

    difference = hr2_number - hr1_number;

    // will hold all the intermediate values to be returned
    output = [];

    // setting up the computation
    new_hour_number = hr1_number
    new_hour_AMorPM = 1 // making this a boolean (AM = 1) to make switching from AM to PM easier
    if (hr1_AMorPM === "PM"){
        new_hour_AMorPM = 0
    }

    // subtract from difference and append the current hour to the output array until you reach 1 or -11; the heart of this algorithm
    const subtractUntil = (subtractUntil, new_hour_number, new_hour_AMorPM, difference) => {
        while (difference != subtractUntil){
            new_hour_number += 1;

            if (new_hour_number == 12){
                new_hour_AMorPM = parseInt(!(new_hour_AMorPM));
            }
            else if (new_hour_number == 13){
                new_hour_number = 1;
            }

            difference -= 1;
            output.push(`${new_hour_number} ${new_hour_AMorPM ? "AM" : "PM"}`);
        }
    }

    // almost all these branches are focused on handling edge cases
    if (hr1_AMorPM == "AM" && hr2_AMorPM == "PM" && difference > 0 && hr2 != "12 PM"){
        subtractUntil(-11, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (hr1_AMorPM == "PM" && hr2 == "12 AM" && difference != 0){
        subtractUntil(1, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (hr1_AMorPM == "PM" && hr2_AMorPM == "AM" && difference > 0){
        subtractUntil(-11, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (hr1 == "12 AM" && hr2_AMorPM == "AM"){
        subtractUntil(-11, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (hr1_AMorPM == "AM" && !(hr1_number == 12) && hr2 == "12 AM"){
        difference += 12;
        subtractUntil(1, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (hr1_AMorPM == "AM" && hr2_AMorPM == "AM" && difference < 0){
        difference += 12;
        subtractUntil(-11, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (hr1 == "12 AM" && !(hr2_number == 12) && hr2_AMorPM == "PM"){
        difference += 12;
        subtractUntil(-11, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (hr1 == "12 PM" && !(hr2_number == 12) && hr2_AMorPM == "AM"){
        difference += 12;
        subtractUntil(-11, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (hr1_AMorPM == "PM" && hr2 == "12 PM"){
        subtractUntil(-11, new_hour_number, new_hour_AMorPM, difference);
    }
    else if (difference > 0){
        subtractUntil(1, new_hour_number, new_hour_AMorPM, difference);
    }
    else{
        if (hr1_AMorPM == "PM" && hr2_AMorPM == "PM" && hr1 != "12 PM"){
            difference += 12;
        }
        subtractUntil(-11, new_hour_number, new_hour_AMorPM, difference);
    }

    return output;
}

// monthString -> number of month
export const getMonthNumber = (monthString) => {
    switch(monthString){
        case "Jan":
            return '1'
        case "Feb":
            return '2'
        case "Mar":
            return '3'
        case "Apr":
            return '4'
        case "May":
            return '5'
        case "Jun":
            return '6'
        case "Jul":
            return '7'
        case "Aug":
            return '8'
        case "Sep":
            return '9'
        case "Oct":
            return '10'
        case "Nov":
            return '11'
        case "Dec":
            return '12'
    }
}

// get an array of strings of all minutes in the day
export const getAllTimes = () => {
    const hoursArr = [
        ["12", "AM"],["1", "AM"],["2", "AM"],["3", "AM"],["4", "AM"],
        ["5", "AM"],["6", "AM"],["7", "AM"],["8", "AM"],["9", "AM"],
        ["10", "AM"],["11", "AM"],["12", "PM"],["1", "PM"],["2", "PM"],
        ["3", "PM"],["4", "PM"],["5", "PM"],["6", "PM"],["7", "PM"],
        ["8", "PM"],["9", "PM"],["10", "PM"],["11", "PM"]
    ]
    
    let timesArray = []
    
    for (i=0; i<hoursArr.length; i++){
        for (j=0; j<60; j++){
            let newTime = hoursArr[i][0] // ex: "12"
            if (j < 10){
                newTime += `:0${j}` 
            }
            else{
                newTime += `:${j}`
            }
            newTime += ` ${hoursArr[i][1]}` // adding AM/PM
            timesArray.push(newTime)
        }
    }
    
    return timesArray;
}

export const dateObjToTimeString = (dateObj) => {
    // 24 hr-based hour and minutes
    let hours = dateObj.getHours();
    let minutes = dateObj.getMinutes();

    // converting minutes to a string and adding leading zero if necessary
    if (minutes < 10){
        minutes = '0' + minutes.toString();
    }
    else{
        minutes = minutes.toString();
    }

    // converting hours to a string and returning the full string
    if (hours > 12){
        hours -= 12;
        return `${hours.toString()}:${minutes} PM`
    }
    else if (hours == 12){
        return `${hours.toString()}:${minutes} PM`
    }
    else if (hours == 0){
        return `12:${minutes} AM`
    }
    else{
        return `${hours.toString()}:${minutes} AM`
    }
}