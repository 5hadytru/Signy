import {View} from 'react-native'
import React from 'react'
import UniversalNavbar from '../subcomponents/UniversalNavbar'
import {CalendarList} from 'react-native-calendars'

const CalendarScreen = ({ navigation }) => {

    return (
        <View>
            <UniversalNavbar navigation={navigation} />
            <CalendarList scrollEnabled={true} theme={{ calendarBackground: "white" }} onDayPress={(day) => {
                navigation.navigate('Timeblocks', { datetime: day.dateString });
                }} />
        </View>
    )
}


export default CalendarScreen
