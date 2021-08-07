import React, {useState, useEffect, useRef} from 'react'
import {StyleSheet, TextInput, Text, TouchableOpacity, View} from 'react-native'
import {PanGestureHandler, LongPressGestureHandler} from 'react-native-gesture-handler'
import { addMinutesToTimeString, getMinuteDifference, getDragAndDropData, getDropzone, getValidPullStates } from '../../utilities/TimeblockUtils'
import {range} from '../../utilities/GeneralUtils'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import Icon from 'react-native-vector-icons/FontAwesome'


const Timeblock = ({id, taskName, startTime, endTime, category, offset, minutes, triggerEditTimeblockModal, sendNewTimes, sendDragAndDropCompletion, currentTimeblocks, currentLayoutData, nextTimeblock, sendObject, deleteTimeblock, thisTBIndex, justCreated}) => {
    
  // drag n drop/pull/slide related state vars
    const [clickedTop, setClickedTop] = useState()
    const [longPressFlag, setLongPressFlag] = useState(() => false)
    const [longPressYCoord, setLongPressYCoord] = useState() // distance from top of timeblock
    const [startTimeState, setStartTimeState] = useState(() => startTime)
    const [endTimeState, setEndTimeState] = useState(() => endTime)
    const [pressInLocation, setPressInLocation] = useState()
    const [hitSlop, setHitSlop] = useState({
      bottom: 0,
      left: 0,
      top: -offset,
      right: 0
    })
    
    /* ensure that a pull animation does not overlap other timeblocks or go off the top of the screen
       will compute a validPullStates object of the form:
        {
          maxTopHalfPullMinutes // maximum minutes to add to the startTime
          maxBottomHalfPullMinutes // maximum minutes to add to the endTime
        }
    */
   const [validPullStates, setValidPullStates] = useState()
   useEffect(() => {
      // get the max amount of minutes the user can pull this timeblock upwards and downwards
      setValidPullStates(getValidPullStates(thisTBIndex, startTime,endTime, currentTimeblocks))
   }, [currentTimeblocks, endTime, startTime])


    // for updating the times when the user drag and drops
    useEffect(() => {
      setStartTimeState(startTime)
      setEndTimeState(endTime)
      
      const mins = getMinuteDifference(startTime, endTime)
      dynamicHeight.value = mins <= 30 ? 30 : mins
    }, [startTime, endTime])

    // write new taskName to storage
    const onChangeTaskName = (text) => {
      console.log(`Edited taskName ${id}: ${text}`);
    }


    // for preventing the TimeblockModal from being opened when the user swipes
    const isTimeblockPressable = useRef(true)

    // for preventing sliding during pulls
    const [isTimeblockBeingPulled, setIsTimeblockBeingPulled] = useState(false)

    // for positioning and showing the delete btn
    const [showDeleteBtn, setShowDeleteBtn] = useState(false)
    const currentHeight = useRef((minutes <= 30) ? 30 : minutes)
    const currentOffset = useRef(offset)


    /* Pull methods and animation logic (not including validPullStates state var which is above) */


    const dynamicHeight = useSharedValue((minutes <= 30) ? 30 : minutes) // negative or positive value indicating degree of contraction or expansion

    // dynamicOffset-related hooks and animation variables
    const dynamicOffset = useSharedValue(offset) // positive or zero value indicating offset from above timeblock in px; from top of ScrollView if first TB

    useEffect(() => {
      dynamicOffset.value = withTiming(offset)
      currentOffset.current = offset
    }, [offset])

    const setDynamicOffset = (newOffset) => {
      dynamicOffset.value = withTiming(newOffset)
    }

    // send this timeblock's offset data to TimeblockScreen; called sendObject for when/if this becomes multifunctional
    useEffect(() => {
    
      sendObject(currentTBObjects => {

        if (!currentTBObjects){
          return {
            id: id,
            initialOffset: offset,
            setDynamicOffset: setDynamicOffset
          }
        }

        currentTBObjects = currentTBObjects.filter(func => func.id != id)

        currentTBObjects.push({
          id: id,
          initialOffset: offset,
          setDynamicOffset: setDynamicOffset
        })

        return currentTBObjects
      })
    }, [currentOffset.current])


    // the dynamic style object
    const pullAnimationStyles = useAnimatedStyle(() => { 
      return {
        height: dynamicHeight.value,
        marginTop: dynamicOffset.value
      }
    })

    // ensure that post-pull times dont overlap any other timeblocks or overlap each other -> send to TimeblockScreen which will rerender
    const validateAndCompleteTimeChange = () => {

      if (startTimeState == startTime && endTimeState == endTime){
        return
      }

      // make sure the new times dont overlap each other (startTime after endTime)
      if (getMinuteDifference(startTimeState, endTimeState) <= 0){
        // reset times because the user is a CLOWN :')
        setStartTimeState(startTime)
        setEndTimeState(endTime)

        // reset offsets for this and the next timeblock then reset this timeblock's height
        try{
          nextTimeblock.setDynamicOffset(nextTimeblock.initialOffset)
        }
        catch{
          console.log("Next timeblock unavailable")
        }
        dynamicOffset.value = withTiming(offset)

        const originalHeight = minutes <= 30 ? 30 : minutes
        dynamicHeight.value = withTiming(originalHeight)
        currentHeight.current = originalHeight

        return
      }

      // if startTime overlaps previous timeblock's endTime, startTime = endTime; same for endTime
      for (i of range(currentTimeblocks.length)){

        if (currentTimeblocks[i].id == id){
          // if the user is altering the startTime, check if startTimeState overlaps previous timeblock's endTime
          if (clickedTop){

            // if currentTimeblocks[i-1] does not exist; this is the earliest timeblock
            if (i == 0){
              break
            }

            // if the startTime overlaps the prev timeblock, set the startTime equal to the prev timeblock's endTime
            if (getMinuteDifference(currentTimeblocks[i-1].endTime, startTimeState) <= 0){
              setStartTimeState(currentTimeblocks[i-1].endTime)
              sendNewTimes(id, currentTimeblocks[i-1].endTime, endTimeState, taskName, category)
              return
            }
          }
          // if the user is altering the endTime, check if endTimeState overlaps next timeblock's startTime
          else{

            // if currentTimeblocks[i+1] does not exist; this is the latest timeblock
            if (i == currentTimeblocks.length - 1){
              break
            }

            // if the endTime overlaps the next timeblock, set the endTime equal to the next timeblock's startTime
            if (getMinuteDifference(endTimeState, currentTimeblocks[i+1].startTime) <= 0){
              setEndTimeState(currentTimeblocks[i+1].startTime)
              sendNewTimes(id, startTimeState, currentTimeblocks[i+1].startTime, taskName, category)
              return
            }
          }
        }
      }
      
      // these two lines solve cross-hour expansion issues for the first and maybe last timeblocks
      const newMins = getMinuteDifference(startTimeState, endTimeState)
      const newHeight = newMins <= 30 ? 30 : newMins
      dynamicHeight.value = withTiming(newHeight)
      currentHeight.current = newHeight

      sendNewTimes(id, startTimeState, endTimeState, taskName, category)
    }


    // using minutesToAdd and clickedTop, confirm that adding these minutes in the form of extra height will not cause overlap w other timeblocks
    const validateNewMinutes = (minutesToAdd) => {

      // ensuring no overlap
      if (clickedTop){
        if (minutesToAdd > validPullStates.maxTopPullMinutes){
          return false
        }
      }
      else{
        if (minutesToAdd > validPullStates.maxBottomPullMinutes){
          return false
        }
      }

      // ensuring the endTime is after the startTime
      if (minutes + minutesToAdd <= 0){
        return false
      }

      return true
    }


    /* Drag and drop methods and animation logic */

    // shake animation state vars and hooks
    const rotationDegrees = useSharedValue(0) // degrees of rotation for the shake; will be an oscillating number

    const shakeAnimationStyles = useAnimatedStyle(() => { // produce a dynamic style object during drag and drop
      return {
        transform: [{
          rotateZ: `${rotationDegrees.value}deg`
        }]
      }
    })


    // complete drag and drop
    const signalDragAndDropCompletion = (translationY) => {

      if (currentTimeblocks.length == 1){ return }

      const dragAndDropData = getDragAndDropData(currentLayoutData.layoutData, currentLayoutData.numTimeblocks, id)

      if (currentLayoutData.numTimeblocks != currentLayoutData.layoutData.length){ throw Error("Full layout data not present while finishing DnD") }

      // get timeblockIndex of dropzone + location of drop within dropzone; if dropzoneIndex = -1 -> invalid dropzone
      const dropzoneObj = getDropzone(translationY, longPressYCoord, dragAndDropData.dropzones)

      console.log(dragAndDropData)
      console.log(dropzoneObj)

      // send dropzone's timeblockIndex, thisTimeblockIndex, and userDraggedUp to TimeblockScreen for setting state and hitting DB
      if (dropzoneObj.dropzoneIndex != -1){
        sendDragAndDropCompletion(dropzoneObj, dragAndDropData.thisTBIndex, translationY < 0)
      }
    }
    

    /* 
        Slide-to-delete methods and logic
    */

    // will hold the current translateX value which can synchronously manipulate the UI thread
    const translateX = useSharedValue(0)

    // the dynamic style object
    const slideAnimationStyles = useAnimatedStyle(() => {
      return {
        transform: [{translateX: translateX.value}]
      }
    })

    return (
      <View>
        <Icon 
          style={{
            position: "absolute", top: currentOffset.current + ((currentHeight.current - 20) / 2), left: 45 
          }}
          name="trash"
          color={showDeleteBtn ? "red" : "white"}
          size={20}
          onPress={() => deleteTimeblock(id)}
        />
        <TouchableOpacity
          activeOpacity={.75} 
          onLongPress={e => {

            setLongPressYCoord(e.nativeEvent.locationY)

            // start the shake animation
            rotationDegrees.value = withRepeat(withSequence(withTiming(.75, {duration: 100}), withTiming(-.75, {duration: 100})), -1)

            setLongPressFlag(true)

            // set timeout for rotationdegrees
            setTimeout(() => rotationDegrees.value = withTiming(0), 2000)
          }}
          delayLongPress={500}
          onPress={() => {
            console.log(dynamicOffset.value, hitSlop, offset)
            if (isTimeblockPressable.current == true){
              triggerEditTimeblockModal(id) 
            }
            else{ 
              translateX.value = withTiming(30, {duration: 100}) 
              isTimeblockPressable.current = true
              setShowDeleteBtn(true)
            }
          }} 
          style={styles.container}  
          onPressIn={e => { 
            setPressInLocation(e.nativeEvent.pageX)
            setClickedTop(e.nativeEvent.locationY <= dynamicHeight.value / 2);
          }}
          onPressOut={e => {
            if (Math.abs(pressInLocation - e.nativeEvent.pageX) >= 10){
              isTimeblockPressable.current = false
            }
          }}
          hitSlop={hitSlop}
        >
            <PanGestureHandler
              
              onGestureEvent={e => {
              
                if (longPressFlag){ return }

                /*
                  Handle sliding
                */
                if (e.nativeEvent.translationX > 20 && !isTimeblockBeingPulled){
                  translateX.value = withTiming(30, {duration: 100})
                  setShowDeleteBtn(true)
                } 
                else if (e.nativeEvent.translationX < -20){
                  translateX.value = withTiming(0, {duration: 100})
                  setShowDeleteBtn(false)
                }

                /*
                  Handling a vertical pull
                */
                // only add/subtract minutes in multiples of 5
                else if (Math.abs(e.nativeEvent.translationY) >= 5){

                  setIsTimeblockBeingPulled(true)

                  // minutes to add relative to the start or end time; can be negative or positive
                  let minutesToAdd = Math.floor(e.nativeEvent.translationY);
                  if (clickedTop){
                    minutesToAdd *= -1
                  }

                  if ((minutesToAdd % 5) != 0 || minutesToAdd == 0) { return }

                  let newMinutes = minutes + minutesToAdd
                  
                  // if the new times are valid, conduct the animation; else, just alter the displayed times
                  if (validateNewMinutes(minutesToAdd)){

                    // if the y velocity is too fast, skip by 10 minutes at a time
                    if (e.nativeEvent.velocityY > 300 && (minutesToAdd % 10) != 0){
                      return
                    }

                    // if the timeblock is big enough, expand or contract it
                    dynamicHeight.value = withTiming(newMinutes <= 30 ? 30 : newMinutes)

                    // adjust this or the next timeblock's offset to balance out the new height/minutes
                    if (clickedTop){
                      dynamicOffset.value = withTiming(offset - minutesToAdd, {duration: 250})
                    }
                    else{
                      try{
                        nextTimeblock.setDynamicOffset(nextTimeblock.initialOffset - minutesToAdd)
                      }
                      catch{}
                    }
                  }
                  else{
                    /* 
                      hitting this branch means the times are now out of order or overlap other timeblocks
                      if overlapping, this timeblock will stop growing upon hitting the collided timeblock
                    */
                    if (clickedTop && minutesToAdd > validPullStates.maxTopPullMinutes){
                      const newHeight = minutes + validPullStates.maxTopPullMinutes
                      dynamicHeight.value = withTiming(newHeight <= 30 ? 30 : newHeight, {duration: 100})
                      dynamicOffset.value = withTiming(0, {duration: 100})
                      minutesToAdd = minutesToAdd
                    }
                    else if (!clickedTop && minutesToAdd > validPullStates.maxBottomPullMinutes){
                      const newHeight = minutes + validPullStates.maxBottomPullMinutes
                      dynamicHeight.value = withTiming(newHeight <= 30 ? 30 : newHeight, {duration: 100})
                      try{
                        nextTimeblock.setDynamicOffset(0)
                      }
                      catch{}
                      minutesToAdd = validPullStates.maxBottomPullMinutes
                    }
                  }
        
                  // change the displayed times no matter what they are
                  clickedTop ? setStartTimeState(addMinutesToTimeString(startTime, -minutesToAdd)) : setEndTimeState(addMinutesToTimeString(endTime, minutesToAdd))
                }   
              }
              }
              maxPointers={1}
              onHandlerStateChange={e => {
                if (e.nativeEvent.state == 5){ // end of Pan

                  if (longPressFlag){
                    rotationDegrees.value = 0
                    setLongPressFlag(false)
                    signalDragAndDropCompletion(e.nativeEvent.translationY)
                  }
                  else{
                    console.log(dynamicOffset.value)
                    setHitSlop({
                      bottom: 0,
                      left: Math.abs(translateX.value) > 0 ? -30 : 0,
                      top: -dynamicOffset.value,
                      right: 0
                    })
                    validateAndCompleteTimeChange()
                  }

                  isTimeblockPressable.current = true

                  currentOffset.current = dynamicOffset.value
                  currentHeight.current = dynamicHeight.value

                  setIsTimeblockBeingPulled(false)
                }
              }}
            >
                <Animated.View style={[styles.textView, shakeAnimationStyles, pullAnimationStyles, slideAnimationStyles]}>
                    <TextInput onSubmitEditing={onChangeTaskName} spellCheck={false} style={styles.taskText} placeholder={"N/A"} placeholderTextColor={"grey"}>
                      {taskName}
                    </TextInput>
                    <Text style={styles.timeText}>
                      {startTimeState} - {endTimeState}
                    </Text>
                </Animated.View>
            </PanGestureHandler>
        </TouchableOpacity>
    </View>
    )
}


const styles = StyleSheet.create({
  textView: {
    alignItems: "center",
    backgroundColor: "lightblue",
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "white",
    flexDirection: 'row',
    justifyContent: "space-between"
  },
  container: {
    marginHorizontal: "10%",
    width: "80%",
    borderWidth: .01,
    borderRadius: 10,
    alignSelf: "center"
  },
  taskText: {
    fontWeight: 'bold',
    paddingLeft: "5%",
    maxWidth: "50%",
    minHeight: 50,
    textAlign: "left"
  },
  timeText: {
    fontWeight: 'bold',
    fontStyle: 'italic',
    textAlign: 'left',
    paddingRight: "5%"
  }
});


export default Timeblock
