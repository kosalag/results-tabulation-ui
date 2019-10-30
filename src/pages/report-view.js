import React, {Component, useEffect, useState} from "react";
import {Link} from 'react-router-dom';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

import {
    getElections,
    getTallySheet,
    getTallySheetVersionHtml, lockTallySheet, requestEditForTallySheet,
    saveTallySheetVersion,
    TALLY_SHEET_STATUS_ENUM, unlockTallySheet
} from "../services/tabulation-api";
import {MessagesProvider, MessagesConsumer, MESSAGE_TYPES} from "../services/messages.provider";
import {
    PATH_ELECTION, PATH_ELECTION_BY_ID,
    PATH_ELECTION_DATA_ENTRY, PATH_ELECTION_DATA_ENTRY_EDIT,
    TALLY_SHEET_CODE_CE_201,
    TALLY_SHEET_CODE_CE_201_PV,
    TALLY_SHEET_CODE_PRE_41
} from "../App";
import Processing from "../components/processing";
import Error from "../components/error";
import BreadCrumb from "../components/bread-crumb";
import Button from "@material-ui/core/Button";
import {MESSAGES_EN} from "../locale/messages_en";


export default function ReportView(props) {
    const {history, election, messages} = props
    const {electionId, electionName} = election;
    const [tallySheet, setTallySheet] = useState(props.tallySheet);
    const [tallySheetVersionId, setTallySheetVersionId] = useState(null);
    const [tallySheetVersionHtml, setTallySheetVersionHtml] = useState("");
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(false);
    const [iframeHeight, setIframeHeight] = useState(600);
    const [iframeWidth, setIframeWidth] = useState("100%");
    const iframeRef = React.createRef();


    const fetchTallySheetVersion = async () => {
        const {tallySheetId, tallySheetCode, latestVersionId, submittedVersionId, lockedVersionId, tallySheetStatus} = tallySheet;
        let tallySheetVersionId = null;
        if (tallySheetCode === TALLY_SHEET_CODE_PRE_41 || tallySheetCode === TALLY_SHEET_CODE_CE_201 || tallySheetCode === TALLY_SHEET_CODE_CE_201_PV) {
            if (lockedVersionId) {
                tallySheetVersionId = lockedVersionId;
            } else if (submittedVersionId) {
                tallySheetVersionId = submittedVersionId;
            } else if (latestVersionId) {
                tallySheetVersionId = latestVersionId;
            }
        } else {
            if (lockedVersionId) {
                tallySheetVersionId = lockedVersionId;
            } else {
                const tallySheetVersion = await saveTallySheetVersion(tallySheetId, tallySheetCode);
                tallySheetVersionId = tallySheetVersion.tallySheetVersionId;
            }
        }

        setTallySheetVersionId(tallySheetVersionId);
    };

    const fetchTallySheetVersionHtml = async () => {
        setTallySheetVersionHtml("Processing ... ");
        const {tallySheetId} = tallySheet;
        const tallySheetVersionHtml = await getTallySheetVersionHtml(tallySheetId, tallySheetVersionId);

        setTallySheetVersionHtml(tallySheetVersionHtml)
    };

    useEffect(() => {
        fetchTallySheetVersion();
    }, [tallySheet]);

    useEffect(() => {
        tallySheetVersionId && fetchTallySheetVersionHtml();
    }, [tallySheetVersionId]);

    const handleIframeHeight = () => (evt) => {
        setIframeHeight(evt.target.contentDocument.documentElement.scrollHeight + 50);
    };

    const handlePrint = () => (evt) => {
        iframeRef.current.contentWindow.print();
    }

    const handleRequestEdit = () => async (evt) => {
        setProcessing(true);
        const {tallySheetId} = tallySheet;
        try {
            const tallySheet = await requestEditForTallySheet(tallySheetId);
            setTallySheet(tallySheet);
            messages.push("Success", MESSAGES_EN.success_report_editable, MESSAGE_TYPES.SUCCESS);
            setTimeout(() => {
                history.push(PATH_ELECTION_DATA_ENTRY_EDIT(electionId, tallySheetId))
            }, 1000)
        } catch (e) {
            messages.push("Error", MESSAGES_EN.error_updating_report, MESSAGE_TYPES.ERROR);
        }
        setProcessing(false);
    };

    const handleVerify = () => async (evt) => {
        setProcessing(true);
        const {tallySheetId} = tallySheet;
        try {
            const tallySheet = await lockTallySheet(tallySheetId, tallySheetVersionId);
            setTallySheet(tallySheet);
            messages.push("Success", MESSAGES_EN.success_report_verify, MESSAGE_TYPES.SUCCESS);
        } catch (e) {
            messages.push("Error", MESSAGES_EN.error_verifying_report, MESSAGE_TYPES.ERROR);
        }
        setProcessing(false);
    };

    const handleUnlock = () => async (evt) => {
        setProcessing(true);
        const {tallySheetId} = tallySheet;
        try {
            const tallySheet = await unlockTallySheet(tallySheetId);
            await setTallySheet(tallySheet);
            messages.push("Success", MESSAGES_EN.success_report_unlock, MESSAGE_TYPES.SUCCESS);
            //fetchTallySheetVersion();
        } catch (e) {
            messages.push("Error", MESSAGES_EN.error_unlock_report, MESSAGE_TYPES.ERROR);
        }
        setProcessing(false);
    };

    const getReportViewJsx = () => {
        const {tallySheetCode, tallySheetStatus} = tallySheet;
        const subElectionId = tallySheet.electionId;

        return <div className="page">
            <BreadCrumb
                links={[
                    {label: "elections", to: PATH_ELECTION()},
                    {label: electionName, to: PATH_ELECTION_BY_ID(electionId)},
                    {
                        label: tallySheetCode.toLowerCase(),
                        to: PATH_ELECTION_DATA_ENTRY(electionId, tallySheetCode, subElectionId)
                    },
                ]}
            />
            <div className="page-content">
                <div>{electionName}</div>
                <div>{tallySheetCode}</div>


                <div className="report-view-status">
                    <div className="report-view-status-actions">
                        <Button variant="contained" size="small" color="default" onClick={handlePrint()}>
                            Print
                        </Button>
                        <Button
                            variant="contained" size="small" color="primary"
                            disabled={processing || !tallySheet.readyToLock}
                            onClick={handleVerify()}
                        >
                            Confirm
                        </Button>
                        {(() => {console.log("TALLY_SHEET_CODE_PRE_41", `${tallySheetCode}-`);
                            if (tallySheetCode === TALLY_SHEET_CODE_PRE_41 || tallySheetCode === TALLY_SHEET_CODE_CE_201 || tallySheetCode === TALLY_SHEET_CODE_CE_201_PV) {
                                return <Button
                                    variant="contained" size="small" color="primary"
                                    disabled={processing || !tallySheet.readyToLock}
                                    onClick={handleRequestEdit()}
                                >
                                    Edit
                                </Button>
                            }
                        })()}
                        <Button
                            variant="contained" size="small" color="primary"
                            disabled={!(tallySheetStatus === TALLY_SHEET_STATUS_ENUM.VERIFIED)}
                            onClick={handleUnlock()}
                        >
                            Unlock
                        </Button>
                    </div>
                    <div className="report-view-status-text">
                        {(() => {
                            if (tallySheetStatus == TALLY_SHEET_STATUS_ENUM.SUBMITTED) {
                                return "This report has been submitted to the system and waiting for verification";
                            } else if (tallySheetStatus == TALLY_SHEET_STATUS_ENUM.VIEWED) {
                                return "This report has been not verified yet";
                            } else if (tallySheetStatus == TALLY_SHEET_STATUS_ENUM.ENTERED) {
                                return "This report has no submitted or verified information. The editing is still in progress.";
                            } else if (tallySheetStatus == TALLY_SHEET_STATUS_ENUM.VERIFIED) {
                                return "This report has been verified.";
                            } else if (tallySheetStatus == TALLY_SHEET_STATUS_ENUM.RELEASED) {
                                return "This report has been released.";
                            }
                        })()}
                    </div>
                </div>


                <iframe
                    style={{border: "none", width: "100%"}}
                    height={iframeHeight}
                    width={iframeWidth}
                    srcDoc={tallySheetVersionHtml}
                    onLoad={handleIframeHeight()}
                    ref={iframeRef}
                >
                </iframe>
            </div>
        </div>
    }

    return getReportViewJsx()
}