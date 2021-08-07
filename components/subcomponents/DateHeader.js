/**
    This file contains the "date header" which contains a date string surrounded by a left and right arrow meant to 
    allow the user to switch dates by 1 day at a time; if they want to change dates by more than 1 day, they can type it in

    This is an independent file since this component is used in the timeblocks and todos pages so far
 */

import React from 'react'
import {Text, View, StyleSheet} from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
 

/**
    Props
        changeDate
            Function that is called when the arrows are pressed; passing in 1 or -1 depending on increment or decrement
            Had to make this a prop to allow the timeblock screen's changeDate logic live within it
        date
            Date to display
 */
const DateHeader = ({ date, changeDate }) => {
    return (
        <View style={styles.dateHeader}>
            <Icon name="chevron-left" size={30} style={styles.dateHeaderArrows} onPress={() => changeDate(-1)} />
            <Text style={styles.dateHeaderText}>{date.toDateString()}</Text>
            <Icon name="chevron-right" size={30} style={styles.dateHeaderArrows} onPress={() => changeDate(1)} />
        </View>
    )
}
 
const styles = StyleSheet.create({
    dateHeader: {
        flexDirection: 'row',
        justifyContent: "space-between",
        paddingHorizontal: "8%",
        paddingTop: "7%",
        paddingBottom: "4%",
        backgroundColor: 'white'
    },
    dateHeaderArrows: {
        color: "black"
    },
    dateHeaderText: {
        fontSize: 22
    }
})

export default DateHeader
 

