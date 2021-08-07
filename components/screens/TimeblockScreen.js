import {View, StyleSheet, ScrollView, TouchableWithoutFeedback, Text} from 'react-native'
import React, {useEffect, useReducer, useState, useRef} from 'react'
import UniversalNavbar from '../subcomponents/UniversalNavbar'
import DateHeader from '../subcomponents/DateHeader'
import Timeblock from '../subcomponents/Timeblock'
import TimeblockNumber from '../subcomponents/TimeblockNumber'
import TimeblockModal from '../subcomponents/TimeblockModal'
import {
        addIntermediateHours, 
        getTimeblockTuples,
        getTimeblockHours,
        getTimeblockNumberTuples,
        updateOneTimeblockInArray,
        updateOneTimeblock,
        changeDate,
        getTimeblocks,
        computeLayoutData,
        createTimeblock,
        executeDragAndDrop,
        deleteTimeblock
    } from '../../utilities/TimeblockUtils'
import {
        getLastTimeblockID
    } from '../../utilities/DatabaseUtils'


// this reducer handles 'date' and 'timeblocks' state variables which are inextricable
const mainReducer = (state, action) => {

    switch (action.type){
        case "set date":
            return {date: action.payload, timeblocks: []} // every time you set date you have to reset the timeblocks anyways
        case "set timeblocks":
            return {date: state.date, timeblocks: action.payload.timeblocks, orderedTimeblockIDs: state.orderedTimeblockIDs}
        case "set timeblocks + order":
            return {date: state.date, timeblocks: action.payload.timeblocks, orderedTimeblockIDs: action.payload.orderedTimeblockIDs}
        case "change timeblock task name": // probably wont need this; just need to save it; it'll already display?
            console.log("change timeblock task name")
            break;
        case "delete timeblock":
            console.log("delete timeblock")
            break;
        default:
            console.log("Reducer call fell to default");
            return state;
    }
}

/**
 * This component is the root of the timeblock interface and will hold the screen's layout and any high level function calls
 * that require access to mainState including adding and removing timeblocks, changing the date, and fetching preexisting timeblock data
 */
const TimeblockScreen = ({route, navigation}) => {

    /** useReducer since timeblocks depend on the date; timeblocks will initialize to timeblocks for current date
    *   useEffect below will recognize dates other than the current one and will dispatch new date for new timeblocks
    *   Don't need to wait for useEffect to check the date before we get timeblocks from DB since DB calls are async
    */
    const [mainState, mainDispatch] = useReducer(mainReducer, {
        date: new Date(),
        timeblocks: [],
        orderedTimeblockIDs: [] 
    });

    // object that contains the props for the TimeblockModal (for creating/updating timeblocks)
    const [modalProps, setModalProps] = useState(() =>{
        return {
            visible: false,
            timeblockID: null,
            taskName: null,
            startTime: null,
            endTime: null,
            category: null,
            sendData: null,
            timeblocks: null
        }
    })

    // for calculating valid dropzones for drag and drop
    const [timeblockLayoutData, setTimeblockLayoutData] = useState([])
    useEffect(() => {
        setTimeblockLayoutData(computeLayoutData(mainState.timeblocks))
    }, [mainState.timeblocks])

    // for creating a timeblock
    const [lastTimeblockID, setLastTimeblockID] = useState()
    useEffect(async () => {
        setLastTimeblockID(await getLastTimeblockID())
    }, [mainState.timeblocks])

    // store certain functions and data from each Timeblock so we can access them from within each timeblock
    const [timeblockObjects, handleTimeblockObjects] = useState(() => [])

    // stores the timestamp of the last valid click so we can detect a double click; does not need to persist across renders
    const [lastClickTime, setLastClickTime] = useState(null);

    // when a double click occurs, trigger the creation of a timeblock by
    const detectDoubleClick = (event) => {

        setLastClickTime(event.nativeEvent.timestamp);

        // if the clicks were close enough to be a dbl click + they werent on the header, create a timeblock
        if ((event.nativeEvent.timestamp - lastClickTime) < 400 && event.nativeEvent.pageY > 105){

            setLastClickTime(null);

            // this function will compute the new timeblock -> shift timeblocks if necessary -> insert the new timeblock (and change order) -> set state and DB 
            createTimeblock(
                event.nativeEvent.locationY, 
                timeblockLayoutData, 
                mainState.timeblocks, 
                lastTimeblockID,
                mainState.orderedTimeblockIDs,
                mainDispatch,
                mainState.date.toDateString()
            )
        }
    }

    /**  
    *    Here i'm seeing if the route prop contains a clicked date in its params; if not, bypass and use current date;
    *    if it does, update the screen only if it is different than mainState's date
    *
    *    The Date constructor will decrement the dateString argument by one for some reason, so
    *    the selected date on the calendar must be incremented by one day before passing it into setDate
    *
    *    This will run onMount and when route.params changes
    */
     useEffect(() => {
        getTimeblocks(
            route.params, 
            mainState.date,
            mainDispatch
        )
    }, [route.params])


    /**
     * Skeleton:
     *      1. Get the numbers (hours) we will need to render
     *              1. Get the numbers present in the timeblocks
     *              2. Add intermediate hours
     *      2. Create list of 3-tuples of the form [hour, marginBottom, id]
    */
    const getTimeblockNumberProps = () => {

        try{
            if (mainState.timeblocks.length == 0){
                return [];
            }
        }
        catch (e){
            console.log("getTimeblockNumberProps error: ", e);
        }

        // getting a list of the hours ("[1-12] [AM|PM]") that are present in the timeblock data
        let numbers = getTimeblockHours(mainState.timeblocks);

        // add hours that are between the currently listed hours; cast to array because it was a Set 
        numbers = addIntermediateHours(Array.from(numbers));

        return getTimeblockNumberTuples(numbers, mainState.timeblocks);
    }


    // get a list of 6-tuples (holding Timeblock data) followed by 3-tuples (holding TimeblockNumber data)
    const getTimeblockProps = () => {
        // if the user has not created any timeblocks for this date
        try{
            if (mainState.timeblocks.length == 0){
                return [];
            }
        }
        catch (e){
            console.log("getTimeblockProps error: ", e);
        }

        // initialize the list with Timeblock 6-tuples -> append TimeblockNumber 3-tuples
        return getTimeblockTuples(mainState.timeblocks);
    }


    // when a timeblock is clicked on, trigger TimeblockModal for editing
    const triggerEditTimeblockModal = (timeblockID) => {

        // console.log("-------------------")
        // mainState.timeblocks.forEach(tb => console.log(tb))
        // console.log(mainState.orderedTimeblockIDs)

        const timeblockToEdit = mainState.timeblocks.find(tb => tb.id == timeblockID);
        setModalProps({
            visible: true,
            timeblockID: timeblockID,
            taskName: timeblockToEdit.taskName,
            startTime: timeblockToEdit.startTime,
            endTime: timeblockToEdit.endTime,
            category: timeblockToEdit.category,
            sendData: onSubmitTimeblockModal,
            timeblocks: mainState.timeblocks
        });
    }

    // handle timeblockModal submission (wont be sent here unless the data is novel and valid)
    const onSubmitTimeblockModal = async (timeblockID, taskName, startTime, endTime, category, possibleNewOrderFlag) => {
        // get new timeblocks -> change orderedTimeblockIDs if necessary -> set state -> update database
        updateOneTimeblock(
            mainState.orderedTimeblockIDs,
            updateOneTimeblockInArray(mainState.timeblocks, timeblockID, taskName, startTime, endTime, category),
            timeblockID,
            startTime,
            possibleNewOrderFlag,
            mainState.date,
            mainDispatch
        )
    }

    // using dropzone data from the Timeblock that was dragged and dropped, calculate new times for all timeblocks as necessary, hit DB, and set state
    /*
        dropzoneObj = {
            dropzoneIndex, // index of dropzone timeblock (userDraggedUp ? lower timeblock : upper timeblock)
            onUpperTB, // boolean indicating if the user dropped the timeblock on top of the upper timeblock in the dropzone
            onLowerTB,
            dropzoneProportion // proportion of the dropzone (whitespace only) that the user passed
        }
    */
    const onDragAndDropCompletion = (dropzoneObj, droppedTBIndex, userDraggedUp) => {

        /* 
            compute the new timeblocks array with any necessary shifts and new times -> 
            ensure that no timeblocks spilled into the previous or next day ->
            rearrange orderedTimeblockIDs and timeblocks ->
            set state and hit DB
        */
        executeDragAndDrop(
            dropzoneObj,
            droppedTBIndex,
            userDraggedUp,
            mainState.timeblocks,
            mainState.orderedTimeblockIDs,
            mainDispatch,
            mainState.date
        )
    }


    // handle the pulling of a timeblock
    const onTimeblockTimeChange = async (timeblockID, startTime, endTime, taskName, category) => {
        // get new timeblocks -> set state -> update database
        updateOneTimeblock(
            null,
            updateOneTimeblockInArray(mainState.timeblocks, timeblockID, taskName, startTime, endTime, category),
            timeblockID,
            startTime,
            false,
            mainState.date,
            mainDispatch
        )
    }


    // onPress for the delete btn
    const onTimeblockDeletion = (timeblockID) => {

        // will remove from state and hit the database
        deleteTimeblock(
            timeblockID,
            mainState.timeblocks,
            mainState.orderedTimeblockIDs,
            mainState.date,
            mainDispatch
        )
    }

    /**
        Skeleton (by View)
            universal navbar (back arrow and hamburger menu btn)
            date header (date to display + left/right arrows for increment/decrement)
                Gonna add a date picker soon
            Timeblocks
            TimeblockNumbers (left side of screen numbers representing hours in the day)
            add timeblock btn
     */
    return (
        <TouchableWithoutFeedback onPress={detectDoubleClick}>
            <View style={styles.container}>
                <UniversalNavbar navigation={navigation} />
                <DateHeader date={mainState.date} changeDate={changeAmt => changeDate(changeAmt, mainState.date, navigation)} />

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        <View id="timeblocks" style={{marginTop: "6%", elevation: 1, zIndex: 1}}>
                            { // render timeblocks with proper pixel offset
                                mainState.timeblocks.length > 0 ? getTimeblockProps().map((timeblockTuple) =>{
                                    return (<Timeblock
                                                key={mainState.timeblocks[timeblockTuple[0]].id}
                                                id={mainState.timeblocks[timeblockTuple[0]].id}
                                                taskName={mainState.timeblocks[timeblockTuple[0]].taskName}
                                                startTime={mainState.timeblocks[timeblockTuple[0]].startTime}
                                                endTime={mainState.timeblocks[timeblockTuple[0]].endTime}
                                                offset={timeblockTuple[1]}
                                                minutes={mainState.timeblocks[timeblockTuple[0]].minutes}
                                                category={mainState.timeblocks[timeblockTuple[0]].category}
                                                triggerEditTimeblockModal={triggerEditTimeblockModal}
                                                sendNewTimes={onTimeblockTimeChange}
                                                sendDragAndDropCompletion={onDragAndDropCompletion}
                                                sendObject={handleTimeblockObjects}
                                                currentTimeblocks={mainState.timeblocks}
                                                currentLayoutData={{
                                                    layoutData: timeblockLayoutData,
                                                    numTimeblocks: mainState.timeblocks.length
                                                }}
                                                nextTimeblock={(mainState.timeblocks.length > timeblockTuple[0] + 1)
                                                    && (timeblockObjects.length >= mainState.timeblocks.length)
                                                    ? timeblockObjects.find(obj => {
                                                        try{
                                                            return obj.id == mainState.timeblocks[timeblockTuple[0] + 1].id
                                                        }
                                                        catch{
                                                            return null
                                                        }
                                                    }) 
                                                    : null  }
                                                deleteTimeblock={onTimeblockDeletion}
                                                thisTBIndex={timeblockTuple[0]}
                                            />)
                                }) : <Text style={styles.noTimeblocksText}>{"No timeblocks"}</Text>
                            }
                        </View>
                        <View id="leftNumbers" style={{ marginTop: "3%", position: "absolute", elevation: 0, zIndex: 0 }}>
                            { // each numberTuple is of the form ["[1-12] [AM|PM]", [0-inf]]
                                getTimeblockNumberProps().map((numberTuple) => {
                                    return <TimeblockNumber 
                                                key={numberTuple[2]}
                                                time={numberTuple[0]} 
                                                marginBottom={numberTuple[1]}
                                            />
                            })}
                        </View>
                        <View style={{height: 60} /*extra height at bottom of page*/}></View>

                        {/* from this point on are components that are invisible by default */}
                        <TimeblockModal 
                            modalProps={modalProps}
                        />
                    </ScrollView>
            </View>
        </TouchableWithoutFeedback>
    )
}


// FUTURE: Timeblock's color and text correspond to its Bucket!
const styles = StyleSheet.create({
    scrollView: {
        backgroundColor: "white"
    },
    leftNumbers: {
        marginLeft: "3%",
        fontSize: 20
    },
    container: {
        width: "100%",
        flex: 1
    },
    noTimeblocksText: {
        fontSize: 20,
        textAlign: "center",
        marginTop: "30%",
        fontWeight: 'bold',
        fontStyle: 'italic'
    }
})

export default TimeblockScreen