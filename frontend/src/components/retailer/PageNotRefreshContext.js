import { createContext, useContext, useState, useEffect } from 'react';

const PageNotRefreshContext = createContext();

export const PageNotRefreshProvider = ({ children }) => {
    // Initialize state with data from sessionStorage if it exists
    //for purchase
    const [draftSave, setDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('draftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse draftSave from sessionStorage', error);
            return null;
        }
    });
    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (draftSave) {
                sessionStorage.setItem('draftSave', JSON.stringify(draftSave));
            } else {
                sessionStorage.removeItem('draftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [draftSave]);


    // Function to clear the draft (e.g., after submission)
    const clearDraft = () => {
        setDraftSave(null);
    };

    //--------------------------------------------------------------------------------

    //for AddSales
    const [salesDraftSave, setSalesDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('salesOpenDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse salesDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (salesDraftSave) {
                sessionStorage.setItem('salesDraftSave', JSON.stringify(salesDraftSave));
            } else {
                sessionStorage.removeItem('salesDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [salesDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearSalesDraft = () => {
        setSalesDraftSave(null);
    };
    //-------------------------------------------------------------------------------

    //for AddSalesOpen

    const [salesOpenDraftSave, setSalesOpenDraftSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('salesOpenDraftSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse salesDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (salesOpenDraftSave) {
                sessionStorage.setItem('salesOpenDraftSave', JSON.stringify(salesOpenDraftSave));
            } else {
                sessionStorage.removeItem('salesOpenDraftSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [salesOpenDraftSave]);

    // Function to clear the draft (e.g., after submission)
    const clearSalesOpenDraft = () => {
        setSalesOpenDraftSave(null);
    };

    //----------------------------------------------------------------------------------------

    //for credit sales return

    const [draftCreditSalesReturnSave, setDraftCreditSalesReturnSave] = useState(() => {
        // Only run on client-side
        if (typeof window === 'undefined') return null;

        try {
            const saved = sessionStorage.getItem('draftCreditSalesReturnSave');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse salesDraftSave from sessionStorage', error);
            return null;
        }
    });

    // Update sessionStorage whenever draftSave changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            if (draftCreditSalesReturnSave) {
                sessionStorage.setItem('draftCreditSalesReturnSave', JSON.stringify(draftCreditSalesReturnSave));
            } else {
                sessionStorage.removeItem('draftCreditSalesReturnSave');
            }
        } catch (error) {
            console.error('Failed to update sessionStorage', error);
        }
    }, [draftCreditSalesReturnSave]);

    // Function to clear the draft (e.g., after submission)
    const clearCreditSalesReturnDraft = () => {
        setDraftCreditSalesReturnSave(null);
    };

    return (
        <PageNotRefreshContext.Provider
            value={{
                //for purchase
                draftSave,
                setDraftSave,
                clearDraft,

                //for credit sales
                salesDraftSave,
                setSalesDraftSave,
                clearSalesDraft,

                //for credit sales open
                salesOpenDraftSave,
                setSalesOpenDraftSave,
                clearSalesOpenDraft,

                //for credit sales return
                draftCreditSalesReturnSave,
                setDraftCreditSalesReturnSave,
                clearCreditSalesReturnDraft
            }}
        >
            {children}
        </PageNotRefreshContext.Provider>
    );
};

export const usePageNotRefreshContext = () => {
    const context = useContext(PageNotRefreshContext);
    if (!context) {
        throw new Error(
            'usePageNotRefreshContext must be used within a PageNotRefreshProvider'
        );
    }
    return context;
};