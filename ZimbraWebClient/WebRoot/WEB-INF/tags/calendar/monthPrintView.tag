<%--
 * 
--%>
<%@ tag body-content="empty" %>
<%@ attribute name="date" rtexprvalue="true" required="true" type="java.util.Calendar" %>
<%@ attribute name="timezone" rtexprvalue="true" required="true" type="java.util.TimeZone"%>
<%@ attribute name="checkedCalendars" rtexprvalue="true" required="true"%>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>
<%@ taglib prefix="fmt" uri="com.zimbra.i18n" %>
<%@ taglib prefix="app" uri="com.zimbra.htmlclient" %>
<%@ taglib prefix="zm" uri="com.zimbra.zm" %>
<app:handleError>
    <zm:getMailbox var="mailbox"/>
    <fmt:message key="noSubject" var="noSubject"/>
    <fmt:setTimeZone value="${timezone}"/>
    <c:set var="context" value="${null}"/>
    <fmt:message var="dayFormat" key="CAL_MONTH_DAY_FORMAT"/>
    <fmt:message var="dayMonthChangeFormat" key="CAL_MONTH_DAY_MONTH_CHANGE_FORMAT"/>
    <fmt:message var="titleFormat" key="CAL_MONTH_TITLE_FORMAT"/>
    <fmt:formatDate var="title" value="${date.time}" pattern="${titleFormat}"/>
    <fmt:getLocale var="userLocale"/>
    <c:set var="dateSymbols" value="${zm:getDateFormatSymbols(userLocale,pageContext)}"/>
    <c:set var="weekDays" value="${dateSymbols.weekdays}"/>
    <c:set var="today" value="${zm:getToday(timezone)}"/>
    <c:set var="prevDate" value="${zm:addMonth(date, -1)}"/>
    <c:set var="nextDate" value="${zm:addMonth(date,  1)}"/>
    <c:set var="currentDay" value="${zm:getFirstDayOfMonthView(date, mailbox.prefs.calendarFirstDayOfWeek)}"/>
    <zm:getValidFolderIds var="validFolderIds" box="${mailbox}" folderid="${checkedCalendars}" varexception="exp"/>
    <c:if test="${not empty exp}">
        <zm:getException var="error" exception="${exp}"/>
        <app:status style="Critical">
            <fmt:message key="${error.code}"/>
        </app:status>
        <!-- ${fn:escapeXml(error.stackStrace)} -->
    </c:if>
    <zm:getAppointmentSummaries timezone="${timezone}" var="appts" folderid="${validFolderIds}" start="${currentDay.timeInMillis}" end="${zm:addDay(currentDay, 42).timeInMillis}" query="${requestScope.calendarQuery}" varexception="gasException"/>
    <c:if test="${not empty gasException}">
        <zm:getException var="error" exception="${gasException}"/>
        <app:status style="Critical">
            <fmt:message key="${error.code}"/>
        </app:status>
        <!-- ${fn:escapeXml(error.stackStrace)} -->
    </c:if>
</app:handleError>
<table width="100%"  cellpadding="0" cellspacing="0" border="0" class="zPrintMsgs">
    <tr>
        <td class='ZhAppContent'>
            <table width="100%" class='ZhCalMonthHeaderTable' cellpadding=2 cellspacing=0 border=0>
                <tr>
                    <td colspan="7" class='ZhCalMonthHeaderMonth'>
                        ${fn:escapeXml(title)}
                    </td>
                </tr>
                <tr>
                    <c:forEach var="day"
                               begin="${mailbox.prefs.calendarFirstDayOfWeek}"
                               end="${mailbox.prefs.calendarFirstDayOfWeek+6}">
                        <td width="14%" class='ZhCalMonthHeaderCellsText'>
                                ${weekDays[(day mod 7)+1]}
                        </td>
                    </c:forEach>
                </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" class='ZhCalMonthTable'>
                <c:set var="lastMonth" value="-1"/>
                <c:forEach var="week" begin="1" end="6">
                    <tr>
                        <c:forEach var="dow" begin="1" end="7" varStatus="dowStatus">
                            <td width="14%" class='ZhCalMonthDay${currentDay.timeInMillis eq date.timeInMillis ? 'Selected':''}'>
                                <table width="100%" cellspacing="2">
                                    <tr>
                                        <c:set var="T" value="${zm:isSameDate(currentDay, today) ? 'T' : ''}"/>
                                        <c:set var="O" value="${not zm:isSameMonth(currentDay, date) ? 'O' : ''}"/>
                                        <td align="right" class='ZhCalDOM${O}${T}'>
                                            <fmt:formatDate var="dayTitle" value="${currentDay.time}" pattern="${zm:getMonth(currentDay) ne lastMonth ? dayMonthChangeFormat : dayFormat}"/>
                                            <c:set var="lastMonth" value="${zm:getMonth(currentDay)}"/>
                                            <app:calendarUrl var="dayUrl" view="day" timezone="${timezone}" rawdate="${currentDay}"/>
                                                ${fn:escapeXml(dayTitle)}
                                        </td>
                                    </tr>
                                    <c:set var="count" value="${0}"/>
                                    <c:set var="dayStart" value="${currentDay.timeInMillis}"/>
                                    <c:set var="dayEnd" value="${zm:addDay(currentDay, 1).timeInMillis}"/>
                                    <zm:forEachAppoinment var="appt" appointments="${appts}" start="${dayStart}" end="${dayEnd}">
                                        <tr><td><app:monthAppt appt="${appt}" start="${dayStart}" end="${dayEnd}" timezone="${timezone}"/></td></tr>
                                        <c:set var="count" value="${count+1}"/>
                                    </zm:forEachAppoinment>
                                    <c:if test="${dowStatus.first and count lt 4}">
                                        <c:forEach begin="1" end="${4-count}"><tr><td>&nbsp;</td></tr></c:forEach>
                                    </c:if>
                                </table>
                            </td>
                            ${zm:getNextDay(currentDay)}
                        </c:forEach>
                    </tr>
                </c:forEach>
            </table>
        </td>
    </tr>
</table>

<style type="text/css">
    .zPrintMsgs *{
        font-size:${mailbox.prefs.defaultPrintFontSize} !important;
    }
</style>